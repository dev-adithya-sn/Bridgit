import { routeProblem, InstitutionCandidate } from "@/lib/routing";
import {
  authenticatedUserId,
  bearerToken,
  isMissingSchemaError,
  SERVICE_KEY_HINT,
  supabaseAsUser,
  supabaseService,
} from "@/lib/supabaseServer";
import type { Problem, RouteProblemResponse } from "@/lib/types";

export const runtime = "nodejs";
// Room for the AI call on Vercel (its default limit can be shorter)
export const maxDuration = 30;

const MIGRATION_003_HINT =
  "Database is missing the domain-routing tables. Run supabase/migrations/003_domain_routing.sql in the Supabase SQL Editor.";

interface InstitutionRow {
  id: string;
  name: string;
  district: string | null;
  domains: string[];
  description: string | null;
  has_incubation_cell: boolean;
}

/**
 * POST { problemId } → ranked institutions, saved as fresh 'suggested' rows.
 *
 * Authorization: the problem's reporter, or an admin, may trigger this —
 * checked explicitly below rather than relying on who can merely *see* the
 * problem, since an approved problem is visible to any signed-in user but
 * generating routing suggestions for it is not everyone's call. Low stakes
 * either way: this only creates 'suggested' rows, nothing is finalized here.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to request routing suggestions." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const problemId = typeof body?.problemId === "string" ? body.problemId : null;
  if (!problemId) return Response.json({ error: "problemId is required." }, { status: 400 });

  const sb = supabaseAsUser(token);
  const { data: problem, error: problemError } = await sb.from("problems").select("*").eq("id", problemId).single();
  if (isMissingSchemaError(problemError)) {
    return Response.json({ error: MIGRATION_003_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (!problem) return Response.json({ error: "Problem not found." }, { status: 404 });

  const { data: profile } = await sb.from("profiles").select("role").eq("id", userId).single();
  const isOwner = (problem as Problem).posted_by === userId;
  const isAdmin = profile?.role === "admin";
  if (!isOwner && !isAdmin) {
    return Response.json(
      { error: "Only the problem's reporter or an admin can request routing suggestions." },
      { status: 403 }
    );
  }

  const { data: institutionRows, error: institutionError } = await sb.from("institutions").select("*");
  if (isMissingSchemaError(institutionError)) {
    return Response.json({ error: MIGRATION_003_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (institutionError) return Response.json({ error: institutionError.message }, { status: 500 });

  const institutions: InstitutionCandidate[] = ((institutionRows ?? []) as InstitutionRow[]).map((i) => ({
    id: i.id,
    name: i.name,
    district: i.district,
    domains: (i.domains ?? []) as InstitutionCandidate["domains"],
    description: i.description,
    hasIncubationCell: i.has_incubation_cell,
  }));

  const result = await routeProblem({
    problem: problem as Problem,
    institutions,
    apiKey: process.env.GEMINI_API_KEY,
  });

  // problem_routing only accepts admin-authenticated writes at the RLS
  // level (see migration 003), so saving suggestions needs the service-role
  // client — the owner-or-admin check above is what stands in for that gate
  // here; see app/api/route-problem/respond/route.ts for the equivalent
  // check on accepting/declining a suggestion.
  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  // Replace any previous *unresolved* suggestions for this problem so
  // re-generating doesn't pile up duplicates; accepted/declined rows (a
  // real decision was made on them) are left alone.
  await service.from("problem_routing").delete().eq("problem_id", problemId).eq("status", "suggested");

  if (result.matches.length === 0) {
    const empty: RouteProblemResponse = { method: result.method, fallbackReason: result.fallbackReason, matches: [] };
    return Response.json(empty);
  }

  const { data: inserted, error: insertError } = await service
    .from("problem_routing")
    .insert(
      result.matches.map((m) => ({
        problem_id: problemId,
        institution_id: m.institutionId,
        method: result.method,
        confidence: m.confidence,
        reasoning: m.reasoning,
      }))
    )
    .select("id, institution_id, confidence, reasoning");
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  const byInstitutionId = new Map(result.matches.map((m) => [m.institutionId, m]));
  const matches: RouteProblemResponse["matches"] = (inserted ?? []).map((row) => {
    const m = byInstitutionId.get(row.institution_id)!;
    return {
      routingId: row.id,
      institutionId: row.institution_id,
      name: m.name,
      domains: m.domains,
      confidence: row.confidence,
      reasoning: row.reasoning,
    };
  });

  const response: RouteProblemResponse = { method: result.method, model: result.model, fallbackReason: result.fallbackReason, matches };
  return Response.json(response);
}
