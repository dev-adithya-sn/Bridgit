import { isMissingSchemaError, supabaseAnon } from "@/lib/supabaseServer";
import { twilioConfig } from "@/lib/twilioConfig";

export const runtime = "nodejs";

/** Which optional integrations are ready. Booleans only — never secrets. */
export async function GET() {
  let migration = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sb = supabaseAnon();
    const [profiles, needs, outreach] = await Promise.all([
      sb.from("profiles").select("capability_description").limit(1),
      sb.from("needs").select("description").limit(1),
      sb.from("outreach").select("id").limit(1),
    ]);
    migration = ![profiles.error, needs.error, outreach.error].some(isMissingSchemaError);
  }

  return Response.json({
    llm: !!process.env.ANTHROPIC_API_KEY?.trim(),
    twilio: twilioConfig() !== null,
    migration,
  });
}
