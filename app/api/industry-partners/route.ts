import { authenticatedUserId, bearerToken, isMissingSchemaError, SERVICE_KEY_HINT, supabaseService } from "@/lib/supabaseServer";
import { PROBLEM_DOMAINS } from "@/lib/types";

export const runtime = "nodejs";

const MIGRATION_003_HINT =
  "Database is missing the domain-routing tables. Run supabase/migrations/003_domain_routing.sql in the Supabase SQL Editor.";

/**
 * POST { name, sector, domains, capabilities? } → creates the industry
 * partner row via the service-role client (same reasoning as
 * app/api/institutions — industry_partners has no client-facing insert
 * policy either). No representatives/verification concept here: migration
 * 004 only introduced one for institutions, and nothing in this task routes
 * problems to industry partners, so there's no accept/decline action to gate.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  const userId = token ? await authenticatedUserId(token) : null;
  if (!token || !userId) return Response.json({ error: "Log in to register as an industry partner." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const sector = typeof body.sector === "string" ? body.sector.trim().slice(0, 100) : "";
  const capabilities = typeof body.capabilities === "string" ? body.capabilities.trim().slice(0, 2000) : null;
  const domains = Array.isArray(body.domains)
    ? body.domains.filter((d: unknown): d is string => typeof d === "string" && (PROBLEM_DOMAINS as readonly string[]).includes(d))
    : [];

  if (name.length < 2) return Response.json({ error: "Enter the organisation's name." }, { status: 400 });
  if (sector.length < 2) return Response.json({ error: "Describe the sector (e.g. Agritech, Healthtech MSME, CSR)." }, { status: 400 });
  if (domains.length === 0) return Response.json({ error: "Pick at least one domain you work in." }, { status: 400 });

  const service = supabaseService();
  if (!service) return Response.json({ error: SERVICE_KEY_HINT, code: "service_key_missing" }, { status: 503 });

  const { data: partner, error } = await service
    .from("industry_partners")
    .insert({ name, sector, domains, capabilities, created_by: userId })
    .select()
    .single();
  if (isMissingSchemaError(error)) {
    return Response.json({ error: MIGRATION_003_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (error || !partner) {
    return Response.json({ error: error?.message ?? "Could not register the industry partner." }, { status: 500 });
  }

  return Response.json({ partner }, { status: 201 });
}
