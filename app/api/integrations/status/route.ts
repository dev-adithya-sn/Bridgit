import { isMissingSchemaError, supabaseAnon } from "@/lib/supabaseServer";
import { twilioConfig } from "@/lib/twilioConfig";

export const runtime = "nodejs";

/** Which optional integrations are ready. Booleans only — never secrets. */
export async function GET() {
  let migration = false; // 001: AI matching + outreach
  let moderation = false; // 002: Q&A + moderation
  let domainRouting = false; // 003: problems.domain + institutions/industry_partners/problem_routing
  let representatives = false; // 004: institution_representatives
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sb = supabaseAnon();
    const [profiles, needs, outreach, problems, answers, domainCol, institutions, routing, reps] = await Promise.all([
      sb.from("profiles").select("capability_description").limit(1),
      sb.from("needs").select("description").limit(1),
      sb.from("outreach").select("id").limit(1),
      sb.from("problems").select("moderation_status").limit(1),
      sb.from("answers").select("id").limit(1),
      sb.from("problems").select("domain").limit(1),
      sb.from("institutions").select("id").limit(1),
      sb.from("problem_routing").select("id").limit(1),
      sb.from("institution_representatives").select("id").limit(1),
    ]);
    migration = ![profiles.error, needs.error, outreach.error].some(isMissingSchemaError);
    moderation = ![problems.error, answers.error].some(isMissingSchemaError);
    domainRouting = ![domainCol.error, institutions.error, routing.error].some(isMissingSchemaError);
    representatives = !isMissingSchemaError(reps.error);
  }

  return Response.json({
    llm: !!process.env.GEMINI_API_KEY?.trim(),
    twilio: twilioConfig() !== null,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    failsafeApprove: process.env.MODERATION_FAILSAFE === "approve",
    migration,
    moderation,
    domainRouting,
    representatives,
  });
}
