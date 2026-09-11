import { isMissingSchemaError, supabaseAnon } from "@/lib/supabaseServer";
import { twilioConfig } from "@/lib/twilioConfig";

export const runtime = "nodejs";

/** Which optional integrations are ready. Booleans only — never secrets. */
export async function GET() {
  let migration = false; // 001: AI matching + outreach
  let moderation = false; // 002: Q&A + moderation
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sb = supabaseAnon();
    const [profiles, needs, outreach, problems, answers] = await Promise.all([
      sb.from("profiles").select("capability_description").limit(1),
      sb.from("needs").select("description").limit(1),
      sb.from("outreach").select("id").limit(1),
      sb.from("problems").select("moderation_status").limit(1),
      sb.from("answers").select("id").limit(1),
    ]);
    migration = ![profiles.error, needs.error, outreach.error].some(isMissingSchemaError);
    moderation = ![problems.error, answers.error].some(isMissingSchemaError);
  }

  return Response.json({
    llm: !!process.env.GEMINI_API_KEY?.trim(),
    twilio: twilioConfig() !== null,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    failsafeApprove: process.env.MODERATION_FAILSAFE === "approve",
    migration,
    moderation,
  });
}
