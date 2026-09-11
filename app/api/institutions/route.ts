import { authenticatedUserId, bearerToken, isMissingSchemaError, SERVICE_KEY_HINT, supabaseService } from "@/lib/supabaseServer";
import { JHARKHAND_DISTRICTS, PROBLEM_DOMAINS } from "@/lib/types";

export const runtime = "nodejs";

const MIGRATION_003_HINT =
  "Database is missing the domain-routing tables. Run supabase/migrations/003_domain_routing.sql in the Supabase SQL Editor.";
const MIGRATION_004_HINT =
  "Database is missing the institution-representatives table. Run supabase/migrations/004_institution_representatives.sql in the Supabase SQL Editor.";

/**
 * POST { name, district?, domains, description?, hasIncubationCell } →
 * creates the institution row and, separately, an *unverified*
 * institution_representatives row for the caller.
 *
 * Both writes use the service-role client (institutions/industry_partners
 * have no client-facing insert policy — see migration 005) — same shape as
 * app/api/problems. Being unverified by default is the point: only an admin
 * can flip that (app/admin/institutions), which is what the accept/decline
 * check in app/api/route-problem/respond actually relies on.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to register an institution." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const district = typeof body.district === "string" && (JHARKHAND_DISTRICTS as readonly string[]).includes(body.district) ? body.district : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;
  const hasIncubationCell = body.hasIncubationCell === true;
  const domains = Array.isArray(body.domains)
    ? body.domains.filter((d: unknown): d is string => typeof d === "string" && (PROBLEM_DOMAINS as readonly string[]).includes(d))
    : [];

  if (name.length < 2) return Response.json({ error: "Enter the institution's name." }, { status: 400 });
  if (domains.length === 0) return Response.json({ error: "Pick at least one domain the institution works in." }, { status: 400 });

  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  const { data: institution, error: insertError } = await service
    .from("institutions")
    .insert({ name, district, domains, description, has_incubation_cell: hasIncubationCell, created_by: userId })
    .select()
    .single();
  if (isMissingSchemaError(insertError)) {
    return Response.json({ error: MIGRATION_003_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (insertError || !institution) {
    return Response.json({ error: insertError?.message ?? "Could not register the institution." }, { status: 500 });
  }

  const { error: repError } = await service
    .from("institution_representatives")
    .insert({ institution_id: institution.id, profile_id: userId, verified: false });
  if (isMissingSchemaError(repError)) {
    return Response.json({ error: MIGRATION_004_HINT, code: "migration_missing", institution }, { status: 503 });
  }
  if (repError) {
    // Institution exists but the rep link failed — surface it rather than pretend it worked.
    return Response.json({ error: `Institution saved, but linking you as a representative failed: ${repError.message}`, institution }, { status: 500 });
  }

  return Response.json({ institution, verified: false }, { status: 201 });
}
