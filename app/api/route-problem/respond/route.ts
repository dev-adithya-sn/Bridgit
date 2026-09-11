import { authenticatedUserId, bearerToken, isMissingSchemaError, SERVICE_KEY_HINT, supabaseAsUser, supabaseService } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const MIGRATION_004_HINT =
  "Database is missing the institution-representatives table. Run supabase/migrations/004_institution_representatives.sql in the Supabase SQL Editor.";

/**
 * POST { routingId, status: "accepted" | "declined" } — an institution's
 * response to a routing suggestion.
 *
 * This uses the service-role client to write, which bypasses the
 * `problem_routing` RLS policy that would otherwise block it (migration 003
 * restricts writes to public.is_admin()). That RLS policy exists to stop an
 * arbitrary authenticated user from accepting work on an institution's
 * behalf, so bypassing it at the DB layer only stays safe if this handler
 * enforces the same rule itself — which is the check below, not merely
 * "is this person logged in".
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to respond to a routing suggestion." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const routingId = typeof body?.routingId === "string" ? body.routingId : null;
  const status = body?.status === "accepted" || body?.status === "declined" ? body.status : null;
  if (!routingId || !status) {
    return Response.json({ error: 'routingId and status ("accepted" or "declined") are required.' }, { status: 400 });
  }

  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  const { data: routing, error: routingError } = await service
    .from("problem_routing")
    .select("id, institution_id, status")
    .eq("id", routingId)
    .single();
  if (isMissingSchemaError(routingError)) {
    return Response.json({ error: "Database is missing the domain-routing tables.", code: "migration_missing" }, { status: 503 });
  }
  if (!routing) return Response.json({ error: "Routing suggestion not found." }, { status: 404 });
  if (routing.status !== "suggested") {
    return Response.json({ error: `This suggestion was already ${routing.status}.` }, { status: 409 });
  }

  // ---------------------------------------------------------------------
  // THE CHECK: caller must be either a platform admin, or a *verified*
  // representative of the institution this specific suggestion targets.
  // Being logged in, owning the problem, or being a rep of some *other*
  // institution are all deliberately insufficient.
  // ---------------------------------------------------------------------
  const { data: profile } = await supabaseAsUser(token).from("profiles").select("role").eq("id", userId).single();
  const isAdmin = profile?.role === "admin";

  let isVerifiedRep = false;
  if (!isAdmin) {
    const { data: rep, error: repError } = await service
      .from("institution_representatives")
      .select("id")
      .eq("institution_id", routing.institution_id)
      .eq("profile_id", userId)
      .eq("verified", true)
      .maybeSingle();
    if (isMissingSchemaError(repError)) {
      return Response.json({ error: MIGRATION_004_HINT, code: "migration_missing" }, { status: 503 });
    }
    isVerifiedRep = !!rep;
  }

  if (!isAdmin && !isVerifiedRep) {
    return Response.json(
      { error: "Only an admin or a verified representative of this institution can respond to this suggestion." },
      { status: 403 }
    );
  }
  // ---------------------------------------------------------------------

  const { data: updated, error: updateError } = await service
    .from("problem_routing")
    .update({ status })
    .eq("id", routingId)
    .select("id, status")
    .single();
  if (updateError || !updated) {
    return Response.json({ error: updateError?.message ?? "Could not update the routing suggestion." }, { status: 500 });
  }

  console.log(`[route-problem/respond] routing=${routingId} status=${status} by=${userId} via=${isAdmin ? "admin" : "verified_rep"}`);
  return Response.json({ id: updated.id, status: updated.status });
}
