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
import type { PostOutcome } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST { problemId, body } — any signed-in user can answer a problem they
 * can see. Moderated first: rejected → 422, flagged → saved as pending,
 * approved → published.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to answer." }, { status: 401 });

  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  const payload = await request.json().catch(() => ({}));
  const problemId = typeof payload.problemId === "string" ? payload.problemId : null;
  const text = typeof payload.body === "string" ? payload.body.trim().slice(0, 4000) : "";
  if (!problemId) return Response.json({ error: "problemId is required." }, { status: 400 });
  if (text.length < 2) return Response.json({ error: "Write an answer first." }, { status: 400 });

  // Only problems the caller can see (RLS) may be answered
  const { data: problem } = await supabaseAsUser(token).from("problems").select("id").eq("id", problemId).single();
  if (!problem) return Response.json({ error: "Problem not found." }, { status: 404 });

  const moderation = await moderateContent({ text, kind: "answer" });
  if (moderation.verdict === "rejected") {
    const outcome: PostOutcome = { verdict: "rejected", reasoning: moderation.reasoning };
    return Response.json(outcome, { status: 422 });
  }

  const { data: inserted, error } = await service
    .from("answers")
    .insert({
      problem_id: problemId,
      author_profile_id: userId,
      body: text,
      moderation_status: moderation.verdict === "approved" ? "approved" : "pending",
      moderation_reason: moderation.verdict === "flagged" ? moderation.reasoning : null,
    })
    .select("id")
    .single();

  if (isMissingSchemaError(error)) {
    return Response.json({ error: MODERATION_MIGRATION_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (error || !inserted) return Response.json({ error: error?.message ?? "Could not save the answer." }, { status: 500 });

  const outcome: PostOutcome = { verdict: moderation.verdict, reasoning: moderation.reasoning, id: inserted.id };
  return Response.json(outcome, { status: 201 });
}
