export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string; // e.g. whatsapp:+14155238886 (the Twilio sandbox number)
}

/** Twilio credentials from env, or null when WhatsApp outreach isn't set up. */
export function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const rawFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!accountSid || !authToken || !rawFrom) return null;
  const from = rawFrom.startsWith("whatsapp:") ? rawFrom : `whatsapp:${rawFrom}`;
  return { accountSid, authToken, from };
}
