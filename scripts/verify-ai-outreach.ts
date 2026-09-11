/**
 * End-to-end check of AI donor matching + WhatsApp outreach against the
 * live Supabase project and a running app (npm run dev).
 * Prerequisites: migration 001 applied, scripts/seed-donors.ts run.
 *
 * Run:  npx tsx scripts/verify-ai-outreach.ts
 *       APP_URL=https://your-app.vercel.app npx tsx scripts/verify-ai-outreach.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const APP = process.env.APP_URL ?? "http://localhost:3000";
const run = Date.now().toString(36);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  const status = await fetch(`${APP}/api/integrations/status`).then((r) => r.json());
  console.log(`      integrations: ${JSON.stringify(status)}`);
  check("migration applied", status.migration === true);
  if (!status.migration) process.exit(1);

  // A camp coordinator posts a need with a free-text description
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: signup, error: signupError } = await sb.auth.signUp({
    email: `camp.verify.${run}@example.com`,
    password: "Demo@12345",
    options: { data: { full_name: "Verify Camp Coordinator", role: "camp", org_name: "Sahibganj Riverside Camp" } },
  });
  if (signupError || !signup.session) throw new Error(`signup: ${signupError?.message ?? "no session"}`);
  const token = signup.session.access_token;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const { data: camp } = await sb.from("camps").select("id, name").eq("district", "Sahibganj").limit(1).single();
  const { data: need, error: needError } = await sb
    .from("needs")
    .insert({
      camp_id: camp!.id,
      type: "medicine",
      quantity_needed: 120,
      unit: "patients' monthly BP/diabetes medicines",
      urgency: 5,
      description: `[verify-${run}] 120 elderly residents have run out of blood-pressure and diabetes medicines. The access road is flooded, so supplies may need to come by boat.`,
      posted_by: signup.session.user.id,
    })
    .select()
    .single();
  check("need with free-text description posted", !needError && !!need, needError?.message);

  const match = await fetch(`${APP}/api/match-need`, { method: "POST", headers, body: JSON.stringify({ needId: need!.id }) });
  const result = await match.json();
  check(`match-need responded (HTTP ${match.status})`, match.ok, result.error);
  console.log(`      method=${result.method}${result.fallbackReason ? ` fallbackReason="${result.fallbackReason}"` : ""}`);
  for (const [i, m] of (result.matches ?? []).entries()) {
    console.log(`      #${i + 1} ${m.name} — confidence ${m.confidence}${m.hasPhone ? " [WhatsApp]" : ""}\n         "${m.reasoning}"`);
  }
  check("ranked matches returned with reasoning", result.matches?.length > 0 && result.matches.every((m: { reasoning: string }) => m.reasoning));
  check("no phone numbers in the response", !JSON.stringify(result).match(/\+\d{8,}/));

  const target = result.matches?.find((m: { hasPhone: boolean }) => m.hasPhone);
  if (!status.twilio) {
    const notify = await fetch(`${APP}/api/notify`, { method: "POST", headers, body: JSON.stringify({ needId: need!.id, donorProfileId: result.matches[0].donorId }) });
    check("notify without Twilio → 503 twilio_not_configured (no crash)", notify.status === 503 && (await notify.json()).code === "twilio_not_configured");
  } else if (!target) {
    console.log("SKIP  notify: no matched donor has a WhatsApp number (seed with DEMO_WHATSAPP_PHONE)");
  } else {
    const notify = await fetch(`${APP}/api/notify`, {
      method: "POST",
      headers,
      body: JSON.stringify({ needId: need!.id, donorProfileId: target.donorId, confidence: target.confidence, reasoning: target.reasoning }),
    });
    const n = await notify.json();
    check(`notify ${target.name}`, n.status === "sent", n.error);
    const { data: rows } = await sb.from("outreach").select("status, confidence, match_reasoning").eq("need_id", need!.id);
    check("outreach row recorded", (rows?.length ?? 0) > 0, JSON.stringify(rows));
    console.log("      → now check the phone: the WhatsApp message should have arrived.");
  }

  // Privacy: anonymous visitors can't read phone numbers but can read donor emails
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const phones = await anon.from("profiles").select("phone_number").limit(1);
  check("anonymous read of phone_number denied", !!phones.error, phones.error?.message);
  const emails = await anon.from("profiles").select("role, email").not("email", "is", null);
  check("anonymous read of email shows donors only", !emails.error && (emails.data ?? []).every((p) => p.role === "ngo" || p.role === "camp"), `${emails.data?.length ?? 0} public emails`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
