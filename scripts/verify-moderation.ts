/**
 * Live check of AI moderation.
 *
 * Part 1 (needs GEMINI_API_KEY in .env.local): runs three sample posts
 * through the moderator and prints each verdict with its reasoning.
 * Part 2 (also needs migrations 001 + 002, SUPABASE_SERVICE_ROLE_KEY and
 * `npm run dev`): posts them through /api/problems and checks visibility,
 * the admin queue, and approval.
 *
 * Run:  npx tsx scripts/verify-moderation.ts
 *       APP_URL=https://your-app.vercel.app npx tsx scripts/verify-moderation.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
for (const k of ["GEMINI_API_KEY", "GEMINI_MODEL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (env[k] && !process.env[k]) process.env[k] = env[k];
}
const APP = process.env.APP_URL ?? "http://localhost:3000";
const run = Date.now().toString(36);

const SAMPLES = [
  {
    expect: "approved",
    label: "civic complaint naming a department and official",
    title: `Drain on Kanke Road blocked for 4 months [verify-${run}]`,
    description:
      "The storm drain outside Kanke Road market has been blocked since May. We have filed three complaints with the Ranchi Municipal Corporation and the Executive Engineer's office keeps saying it will be cleared 'next week'. Sewage now overflows into the road and two children have fallen ill. We need the department to send a desilting crew.",
  },
  {
    expect: "rejected",
    label: "spam / advertising",
    title: `BEST OFFER!!! [verify-${run}]`,
    description:
      "Buy 1000 Instagram followers for just Rs 99!!! 100% real, instant delivery. WhatsApp now for crypto doubling scheme, earn 5x in 7 days, limited offer click click click",
  },
  {
    expect: "flagged",
    label: "personal attack + party-political campaigning",
    title: `Councillor Ramesh Verma is a traitor [verify-${run}]`,
    description:
      "Councillor Ramesh Verma is a thieving scoundrel and a traitor to this town. Every true resident must vote his party out in the next election and make sure he learns what happens to people like him.",
  },
] as const;

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not in .env.local — add a free key from https://aistudio.google.com/apikey first.");
    process.exit(1);
  }
  const { moderateContent } = await import("../lib/moderation");

  console.log("── Part 1: AI verdicts ──");
  for (const s of SAMPLES) {
    const r = await moderateContent({ text: `${s.title}\n\n${s.description}`, kind: "problem" });
    check(`${s.label} → ${s.expect}`, r.method === "llm" && r.verdict === s.expect, `got ${r.verdict} (${r.method}): ${r.reasoning}`);
  }

  const status = await fetch(`${APP}/api/integrations/status`).then((r) => r.json()).catch(() => null);
  if (!status?.moderation || !status?.serviceKey) {
    console.log(`\nSKIP  Part 2 — needs migration 002 + SUPABASE_SERVICE_ROLE_KEY + a running app (status: ${JSON.stringify(status)})`);
    finish();
  }

  console.log("\n── Part 2: posting, visibility and the admin queue ──");
  const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const signUp = async (role: string) => {
    const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signUp({
      email: `${role}.moderation.${run}@example.com`,
      password: "Demo@12345",
      options: { data: { full_name: `Moderation check ${role}`, role } },
    });
    if (error || !data.session) throw new Error(`signup ${role}: ${error?.message ?? "no session"}`);
    return { sb, token: data.session.access_token };
  };
  const citizen = await signUp("citizen");
  const anon = createClient(URL_, KEY, { auth: { persistSession: false } });

  const ids: Record<string, string | undefined> = {};
  for (const s of SAMPLES) {
    const res = await fetch(`${APP}/api/problems`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${citizen.token}` },
      body: JSON.stringify({ title: s.title, description: s.description, category: "Civic Infrastructure", district: "Ranchi", urgency: 3, population_affected: 200, lat: null, lng: null }),
    });
    const body = await res.json();
    ids[s.expect] = body.id;
    check(`POST ${s.label} → ${s.expect}`, body.verdict === s.expect, `HTTP ${res.status}, verdict ${body.verdict}`);
  }

  const visible = async (client: typeof anon, id?: string) =>
    !!id && !!(await client.from("problems").select("id").eq("id", id).maybeSingle()).data;

  check("approved post visible to the public", await visible(anon, ids.approved));
  check("rejected post was not saved", ids.rejected === undefined);
  check("flagged post hidden from the public", !(await visible(anon, ids.flagged)));
  check("flagged post visible to its author", await visible(citizen.sb, ids.flagged));

  const direct = await citizen.sb.from("problems").insert({ title: "bypass", description: "direct insert", category: "Other", district: "Ranchi", moderation_status: "approved" });
  check("direct browser insert is blocked (can't skip moderation)", !!direct.error, direct.error?.message);

  if (ids.flagged) {
    const selfApprove = await citizen.sb.from("problems").update({ moderation_status: "approved" }).eq("id", ids.flagged);
    check("author can't approve their own flagged post", !!selfApprove.error, selfApprove.error?.message);

    const admin = await signUp("admin");
    const { data: queue } = await admin.sb.from("problems").select("id, moderation_reason").eq("moderation_status", "pending");
    const inQueue = queue?.find((q) => q.id === ids.flagged);
    check("flagged post appears in the admin queue with AI reasoning", !!inQueue?.moderation_reason, inQueue?.moderation_reason ?? "");

    const approve = await admin.sb.from("problems").update({ moderation_status: "approved" }).eq("id", ids.flagged);
    check("admin approves it", !approve.error, approve.error?.message);
    check("approved-by-admin post now public", await visible(anon, ids.flagged));
  }

  finish();
}

function finish(): never {
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
