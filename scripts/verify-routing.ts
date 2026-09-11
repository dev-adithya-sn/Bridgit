/**
 * Live check of domain routing: classification, generating suggestions,
 * and — the point of this script — that accepting/declining one is actually
 * gated to an admin or a *verified* representative of the target
 * institution, not just any authenticated user.
 *
 * Needs: migrations 001-005 applied, SUPABASE_SERVICE_ROLE_KEY, and
 * `npm run dev` running. GEMINI_API_KEY is optional — the description below
 * is written to match both the LLM path and the keyword fallback, so this
 * passes either way.
 *
 * Run:  npx tsx scripts/verify-routing.ts
 *       APP_URL=https://your-app.vercel.app npx tsx scripts/verify-routing.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.APP_URL ?? "http://localhost:3000";
const run = Date.now().toString(36);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}
function finish(): never {
  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

async function signUp(role: string, extra: Record<string, unknown> = {}) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signUp({
    email: `${role}.routing.${run}.${Math.random().toString(36).slice(2, 6)}@example.com`,
    password: "Demo@12345",
    options: { data: { full_name: `Routing check ${role}`, role, ...extra } },
  });
  if (error || !data.session) throw new Error(`signup ${role}: ${error?.message ?? "no session"}`);
  return { sb, userId: data.user!.id, token: data.session.access_token };
}

function post(path: string, token: string, body: unknown) {
  return fetch(`${APP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));
}

const PROBLEM = {
  title: `Village primary school has no usable classroom [verify-${run}]`,
  description:
    "The only classroom at the village primary school collapsed after last month's rain. 40 students and 2 teachers now hold class under a tree, with no protection once the next rains start.",
};

async function main() {
  const status = await fetch(`${APP}/api/integrations/status`).then((r) => r.json()).catch(() => null);
  console.log(`integrations: ${JSON.stringify(status)}`);
  if (!status?.domainRouting || !status?.representatives || !status?.serviceKey) {
    console.log("\nSKIP — needs migrations 003+004 applied and SUPABASE_SERVICE_ROLE_KEY set.");
    process.exit(0);
  }

  // ---- classification (works with or without GEMINI_API_KEY) ----
  const citizen = await signUp("citizen");
  const classify = await post("/api/classify-domain", citizen.token, PROBLEM);
  check("classify-domain suggests Education", classify.status === 200 && classify.json.domain === "Education", JSON.stringify(classify.json));

  // ---- citizen posts the problem with that domain ----
  const posted = await post("/api/problems", citizen.token, {
    ...PROBLEM,
    category: "Education",
    domain: "Education",
    district: "Ranchi",
    urgency: 4,
    population_affected: 40,
    lat: null,
    lng: null,
  });
  check("problem posted with domain", posted.status === 201 && posted.json.verdict !== "rejected", JSON.stringify(posted.json));
  const problemId = posted.json.id;

  // ---- a bystander citizen cannot generate routing for someone else's problem ----
  const bystander = await signUp("citizen");
  const forbiddenGenerate = await post("/api/route-problem", bystander.token, { problemId });
  check("non-owner, non-admin can't generate routing suggestions", forbiddenGenerate.status === 403, JSON.stringify(forbiddenGenerate.json));

  // ---- two institutions: one matches the domain, one doesn't ----
  const instA = await signUp("institution", { org_name: `Ranchi Institute of Technology ${run}` });
  const createA = await post("/api/institutions", instA.token, {
    name: `Ranchi Institute of Technology ${run}`,
    district: "Ranchi",
    domains: ["Education", "Urban Development"],
    description: "Education department runs a community-teaching outreach program and a student incubation cell.",
    hasIncubationCell: true,
  });
  check("institution A registered (unverified by default)", createA.status === 201 && createA.json.verified === false, JSON.stringify(createA.json));
  const institutionAId = createA.json.institution?.id;

  const instB = await signUp("institution", { org_name: `Dhanbad Water Institute ${run}` });
  await post("/api/institutions", instB.token, {
    name: `Dhanbad Water Institute ${run}`,
    district: "Dhanbad",
    domains: ["Water Resources"],
    description: "Focuses purely on groundwater recharge and water-quality testing.",
    hasIncubationCell: false,
  });

  // ---- owner generates routing suggestions ----
  const generated = await post("/api/route-problem", citizen.token, { problemId });
  check("owner generates routing suggestions", generated.status === 200, JSON.stringify(generated.json));
  const matchForA = (generated.json.matches ?? []).find((m: { institutionId: string }) => m.institutionId === institutionAId);
  check("Education institution is ranked with reasoning", !!matchForA?.reasoning, JSON.stringify(matchForA));
  check("unrelated Water Resources institution is not suggested", !(generated.json.matches ?? []).some((m: { institutionId: string }) => m.institutionId !== institutionAId && m.institutionId));
  const routingId: string | undefined = matchForA?.routingId;
  check("suggestion row has a routingId to act on", !!routingId, JSON.stringify(matchForA));

  if (routingId) {
    // ---- unverified rep of the RIGHT institution still can't accept ----
    const deniedUnverified = await post("/api/route-problem/respond", instA.token, { routingId, status: "accepted" });
    check("unverified representative of institution A cannot accept", deniedUnverified.status === 403, JSON.stringify(deniedUnverified.json));

    // ---- a bystander (no relation to the institution at all) can't either ----
    const deniedBystander = await post("/api/route-problem/respond", bystander.token, { routingId, status: "accepted" });
    check("unrelated authenticated user cannot accept", deniedBystander.status === 403, JSON.stringify(deniedBystander.json));

    // ---- admin verifies instA's representative (the actual gate) ----
    const admin = await signUp("admin");
    const { data: repRow } = await admin.sb
      .from("institution_representatives")
      .select("id, verified")
      .eq("institution_id", institutionAId)
      .eq("profile_id", instA.userId)
      .single();
    check("admin can see the pending rep row", !!repRow && repRow.verified === false, JSON.stringify(repRow));
    const verifyUpdate = await admin.sb.from("institution_representatives").update({ verified: true }).eq("id", repRow!.id);
    check("admin verifies the representative", !verifyUpdate.error, verifyUpdate.error?.message);

    // ---- now the verified rep can accept ----
    const accepted = await post("/api/route-problem/respond", instA.token, { routingId, status: "accepted" });
    check("verified representative can accept", accepted.status === 200 && accepted.json.status === "accepted", JSON.stringify(accepted.json));

    // ---- reflected publicly: problem detail's routing list + dashboard's "engaged institutions" ----
    const anon = createClient(URL_, KEY, { auth: { persistSession: false } });
    const { data: routingRow } = await anon.from("problem_routing").select("status").eq("id", routingId).single();
    check("problem detail sees status=accepted", routingRow?.status === "accepted", JSON.stringify(routingRow));
    const { data: engaged } = await anon.from("problem_routing").select("institution_id").eq("status", "accepted");
    check(
      "dashboard's institutions-engaged set includes institution A",
      !!engaged?.some((r) => r.institution_id === institutionAId)
    );

    // ---- accepting again is refused (already responded to) ----
    const already = await post("/api/route-problem/respond", instA.token, { routingId, status: "declined" });
    check("responding twice is refused", already.status === 409, JSON.stringify(already.json));
  }

  finish();
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
