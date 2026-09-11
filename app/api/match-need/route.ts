import { matchNeed, Donor, NeedWithCamp } from "@/lib/capabilityMatching";
import { bearerToken, isMissingSchemaError, MIGRATION_HINT, supabaseAsUser } from "@/lib/supabaseServer";
import type { Resource, Role } from "@/lib/types";

export const runtime = "nodejs";
// Room for the AI call on Vercel (its default limit can be shorter)
export const maxDuration = 30;

interface DonorRow {
  id: string;
  full_name: string;
  org_name: string | null;
  role: Role;
  email: string | null;
  capability_description: string | null;
  phone_number: string | null;
}

/**
 * POST { needId } → donors ranked for that need.
 * The need's description, type, urgency and district are loaded here from
 * the database rather than trusted from the request body.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Log in to match donors." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const needId = typeof body?.needId === "string" ? body.needId : null;
  if (!needId) return Response.json({ error: "needId is required." }, { status: 400 });

  const sb = supabaseAsUser(token);
  const { data: auth, error: authError } = await sb.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Session expired — log in again." }, { status: 401 });

  const { data: need } = await sb.from("needs").select("*, camps(*)").eq("id", needId).single();
  if (!need) return Response.json({ error: "Need not found." }, { status: 404 });

  const { data: donorRows, error: donorError } = await sb
    .from("profiles")
    .select("id, full_name, org_name, role, email, capability_description, phone_number")
    .in("role", ["ngo", "camp"])
    .not("capability_description", "is", null)
    .neq("id", auth.user.id);
  if (isMissingSchemaError(donorError)) {
    return Response.json({ error: MIGRATION_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (donorError) return Response.json({ error: donorError.message }, { status: 500 });

  // Phone numbers stay on the server: donors only carry a hasPhone flag.
  const donors: Donor[] = ((donorRows ?? []) as DonorRow[])
    .filter((d) => d.capability_description?.trim())
    .map((d) => ({
      id: d.id,
      name: d.org_name || d.full_name || "Unnamed donor",
      role: d.role,
      email: d.email,
      capability: d.capability_description!.trim(),
      hasPhone: !!d.phone_number?.trim(),
    }));

  let resources: Resource[] = [];
  if (donors.length > 0) {
    const { data } = await sb
      .from("resources")
      .select("*")
      .eq("type", need.type)
      .eq("status", "available")
      .in("posted_by", donors.map((d) => d.id));
    resources = (data as Resource[]) ?? [];
  }

  const result = await matchNeed({
    need: need as NeedWithCamp,
    donors,
    resources,
    apiKey: process.env.GEMINI_API_KEY,
  });
  return Response.json(result);
}
