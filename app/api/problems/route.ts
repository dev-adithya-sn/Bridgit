import { moderateContent } from "@/lib/moderation";
import {
  authenticatedUserId,
  bearerToken,
  isMissingSchemaError,
  MODERATION_MIGRATION_HINT,
  SERVICE_KEY_HINT,
  supabaseAsUser,
  supabaseService,
} from "@/lib/supabaseServer";
import { JHARKHAND_DISTRICTS, PROBLEM_CATEGORIES, PostOutcome } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * POST a new problem. The text is moderated first; only then is the row
 * saved, with the author taken from the verified session.
 * rejected → 422, nothing saved · flagged → saved as pending · approved → published.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to report a problem." }, { status: 401 });

  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = str(body.title, 200);
  const description = str(body.description, 5000);
  const category = str(body.category, 50);
  const district = str(body.district, 50);
  const ward = str(body.ward, 100) || null;
  const urgency = num(body.urgency);
  const population = num(body.population_affected);
  const lat = num(body.lat);
  const lng = num(body.lng);

  const problems: string[] = [];
  if (title.length < 3) problems.push("a title");
  if (description.length < 10) problems.push("a description of at least 10 characters");
  if (!(PROBLEM_CATEGORIES as readonly string[]).includes(category)) problems.push("a valid category");
  if (!(JHARKHAND_DISTRICTS as readonly string[]).includes(district)) problems.push("a valid district");
  if (urgency === null || !Number.isInteger(urgency) || urgency < 1 || urgency > 5) problems.push("urgency from 1 to 5");
  if (population === null || population < 0) problems.push("the number of people affected");
  if ((lat === null) !== (lng === null) || (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180))) {
    problems.push("a valid map location");
  }
  if (problems.length) return Response.json({ error: `Please provide ${problems.join(", ")}.` }, { status: 400 });

  const moderation = await moderateContent({ text: `${title}\n\n${description}`, kind: "problem" });
  if (moderation.verdict === "rejected") {
    const outcome: PostOutcome = { verdict: "rejected", reasoning: moderation.reasoning };
    return Response.json(outcome, { status: 422 });
  }

  const { data: profile } = await supabaseAsUser(token).from("profiles").select("full_name").eq("id", userId).single();
  const { data: authUser } = await service.auth.admin.getUserById(userId);

  const { data: inserted, error } = await service
    .from("problems")
    .insert({
      title,
      description,
      category,
      district,
      ward,
      lat,
      lng,
      urgency,
      population_affected: Math.round(population!),
      posted_by: userId,
      poster_name: profile?.full_name || authUser?.user?.email || "Anonymous",
      moderation_status: moderation.verdict === "approved" ? "approved" : "pending",
      moderation_reason: moderation.verdict === "flagged" ? moderation.reasoning : null,
    })
    .select("id")
    .single();

  if (isMissingSchemaError(error)) {
    return Response.json({ error: MODERATION_MIGRATION_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (error || !inserted) return Response.json({ error: error?.message ?? "Could not save the problem." }, { status: 500 });

  const outcome: PostOutcome = { verdict: moderation.verdict, reasoning: moderation.reasoning, id: inserted.id };
  return Response.json(outcome, { status: 201 });
}
