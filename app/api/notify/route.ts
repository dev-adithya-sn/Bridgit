import twilio from "twilio";
import { normalizePhone } from "@/lib/phone";
import { twilioConfig } from "@/lib/twilioConfig";
import { bearerToken, isMissingSchemaError, MIGRATION_HINT, supabaseAsUser } from "@/lib/supabaseServer";
import { URGENCY_LABELS } from "@/lib/types";

export const runtime = "nodejs";

// Twilio accepts a message first and can reject it moments later (e.g. the
// number never joined the sandbox), so we check its status once after this.
const STATUS_RECHECK_MS = 2500;

const TWILIO_HINTS: Record<number, string> = {
  63015: "this number hasn't joined the Twilio WhatsApp sandbox — send the sandbox join code from it first",
  63016: "outside WhatsApp's 24-hour window — have the donor message the sandbox again, then retry",
  21211: "the phone number is not valid",
};

function describeTwilioError(code: number | null | undefined, message: string | null | undefined): string {
  const hint = code ? TWILIO_HINTS[code] : undefined;
  return [code ? `Twilio error ${code}` : "Twilio error", hint ?? message].filter(Boolean).join(": ");
}

/**
 * POST { needId, donorProfileId, confidence?, reasoning? }
 * Sends one WhatsApp message to the donor and records the attempt in outreach.
 */
export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Log in to notify donors." }, { status: 401 });

  const config = twilioConfig();
  if (!config) {
    return Response.json(
      { error: "WhatsApp outreach isn't set up: add the TWILIO_* values to .env.local.", code: "twilio_not_configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const needId = typeof body?.needId === "string" ? body.needId : null;
  const donorId = typeof body?.donorProfileId === "string" ? body.donorProfileId : null;
  if (!needId || !donorId) {
    return Response.json({ error: "needId and donorProfileId are required." }, { status: 400 });
  }
  const confidence =
    typeof body?.confidence === "number" ? Math.round(Math.min(100, Math.max(0, body.confidence))) : null;
  const reasoning = typeof body?.reasoning === "string" ? body.reasoning.slice(0, 400) : null;

  const sb = supabaseAsUser(token);
  const { data: auth, error: authError } = await sb.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Session expired — log in again." }, { status: 401 });

  const { data: need } = await sb.from("needs").select("*, camps(*)").eq("id", needId).single();
  if (!need) return Response.json({ error: "Need not found." }, { status: 404 });

  const { data: donor, error: donorError } = await sb
    .from("profiles")
    .select("id, full_name, org_name, phone_number")
    .eq("id", donorId)
    .single();
  if (isMissingSchemaError(donorError)) {
    return Response.json({ error: MIGRATION_HINT, code: "migration_missing" }, { status: 503 });
  }
  if (!donor) return Response.json({ error: "Donor not found." }, { status: 404 });

  const phone = donor.phone_number ? normalizePhone(donor.phone_number) : null;
  if (!phone) {
    return Response.json({ error: "This donor hasn't added a valid WhatsApp number." }, { status: 400 });
  }

  const stillNeeded = need.quantity_needed - need.quantity_received;
  const messageBody =
    `Bridge-It: ${stillNeeded} ${need.unit} of ${need.type} needed at ${need.camps.name} in ${need.camps.district}, ` +
    `urgency ${need.urgency}/5 (${URGENCY_LABELS[need.urgency]}).` +
    (need.description ? ` ${need.description.slice(0, 300)}` : "") +
    ` Can you help? Reply YES to confirm.`;

  let status: "sent" | "failed" = "sent";
  let error: string | undefined;
  let messageSid: string | undefined;
  try {
    const client = twilio(config.accountSid, config.authToken);
    const message = await client.messages.create({ from: config.from, to: `whatsapp:${phone}`, body: messageBody });
    messageSid = message.sid;
    let latest = message;
    if (message.status !== "failed" && message.status !== "undelivered") {
      await new Promise((resolve) => setTimeout(resolve, STATUS_RECHECK_MS));
      latest = await client.messages(message.sid).fetch();
    }
    if (latest.status === "failed" || latest.status === "undelivered") {
      status = "failed";
      error = describeTwilioError(latest.errorCode, latest.errorMessage);
    }
  } catch (e) {
    const err = e as { code?: number; message?: string };
    status = "failed";
    error = describeTwilioError(err.code, err.message);
  }

  const { error: logError } = await sb.from("outreach").insert({
    need_id: needId,
    donor_profile_id: donorId,
    match_reasoning: reasoning,
    confidence,
    channel: "whatsapp",
    status,
  });
  if (logError) console.error(`[notify] outreach insert failed: ${logError.message}`);
  console.log(`[notify] donor=${donorId} need=${needId} status=${status}${error ? ` error="${error}"` : ""}`);

  return Response.json({
    status,
    error,
    messageSid,
    logged: !logError,
    logError: logError ? (isMissingSchemaError(logError) ? MIGRATION_HINT : logError.message) : undefined,
  });
}
