/**
 * End-to-end verification of the demo script against the live Supabase project.
 * Exercises the same code paths the UI uses (incl. lib/matching.ts).
 * Run: npx tsx scripts/verify-demo.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { suggestMatches } from "../lib/matching";
import type { Need, Camp } from "../lib/types";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PASSWORD = "Demo@12345";
const run = Date.now().toString(36);
const emails = {
  citizen: `citizen.demo.${run}@example.com`,
  team: `team.demo.${run}@example.com`,
  ngo: `ngo.demo.${run}@example.com`,
};

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function signUp(email: string, role: string, name: string) {
  const sb = createClient(URL_, KEY);
  const { data, error } = await sb.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: name, role, org_name: name } },
  });
  if (error) throw new Error(`signup ${role}: ${error.message}`);
  if (!data.session)
    throw new Error(
      `signup ${role}: no session returned — "Confirm email" is still ON in Supabase Auth settings`
    );
  return { sb, userId: data.user!.id };
}

async function main() {
  // ---- (a) Citizen posts a problem with a location pin ----
  const citizen = await signUp(emails.citizen, "citizen", "Demo Citizen");
  const { data: problem, error: pErr } = await citizen.sb
    .from("problems")
    .insert({
      title: `Ward 4 needs a medical camp [verify-${run}]`,
      description: "600 people in the shelter have no doctor access after the flood.",
      category: "Medical",
      district: "Sahibganj",
      ward: "Ward 4",
      lat: 25.25, lng: 87.64,
      urgency: 5,
      population_affected: 600,
      posted_by: citizen.userId,
      poster_name: "Demo Citizen",
    })
    .select()
    .single();
  check("(a) citizen posts problem with pin", !pErr && !!problem, pErr?.message);

  // ---- (b) University team claims → solution → resolved ----
  const team = await signUp(emails.team, "university_team", "Demo University Team");
  const { error: claimErr } = await team.sb
    .from("problems")
    .update({ status: "claimed", claimed_by: team.userId, claimed_by_name: "Demo University Team" })
    .eq("id", problem!.id);
  const { error: solErr } = await team.sb
    .from("problems")
    .update({ solution: "Mobile medical camp with rotating PHC doctors, 2-week deployment." })
    .eq("id", problem!.id);
  const { error: resErr } = await team.sb
    .from("problems")
    .update({ status: "resolved" })
    .eq("id", problem!.id);
  const { data: pAfter } = await team.sb.from("problems").select("status,solution").eq("id", problem!.id).single();
  check("(b) claim → solution → resolved", !claimErr && !solErr && !resErr && pAfter?.status === "resolved" && !!pAfter?.solution);

  // ---- (c) NGO posts 1,000 water bottles → matching ranks by score, not distance ----
  const ngo = await signUp(emails.ngo, "ngo", "Demo Water NGO");
  const { data: resource, error: rErr } = await ngo.sb
    .from("resources")
    .insert({
      type: "water", quantity: 1000, quantity_remaining: 1000,
      unit: "bottles (1L)", district: "Ranchi", lat: 23.36, lng: 85.33,
      posted_by: ngo.userId, donor_name: "Demo Water NGO",
    })
    .select()
    .single();
  check("(c1) NGO posts 1,000 water bottles", !rErr && !!resource, rErr?.message);

  // Same matching path as app/resources/page.tsx
  const { data: openNeeds } = await ngo.sb
    .from("needs").select("*, camps(*)").eq("type", "water").eq("status", "open");
  const needs = (openNeeds ?? []) as (Need & { camps: Camp })[];
  const suggestions = suggestMatches(needs, 23.36, 85.33, 1000);
  const top = suggestions[0];
  console.log("      ranked:", suggestions.map((s) =>
    `${s.need.camps.name.split(" ")[0]} score=${s.breakdown.finalScore} dist=${s.breakdown.distanceKm}km alloc=${s.quantityAllocated}`).join(" | "));
  const sahibganjTop = top?.need.camps.district === "Sahibganj";
  const closerExists = needs.some((n) => n.camps.district === "Ranchi");
  check("(c2) farther high-urgency camp outranks closer calm camp",
    sahibganjTop && closerExists,
    top ? `top=${top.need.camps.name} (urgency ${top.need.urgency}, ${top.breakdown.distanceKm} km)` : "no suggestions");

  const { data: insertedMatches, error: mErr } = await ngo.sb
    .from("matches")
    .insert(suggestions.map((s) => ({
      resource_id: resource!.id, need_id: s.need.id,
      quantity_allocated: s.quantityAllocated, score: s.breakdown.finalScore,
      score_breakdown: s.breakdown,
    })))
    .select();
  check("(c3) suggested matches written with score breakdown", !mErr && (insertedMatches?.length ?? 0) > 0, mErr?.message);

  // Accept the top match — same updates as the accept() handler in app/matches/page.tsx
  const m = insertedMatches!.find((x) => x.need_id === top.need.id)!;
  const newReceived = top.need.quantity_received + m.quantity_allocated;
  const newRemaining = Math.max(0, resource!.quantity_remaining - m.quantity_allocated);
  const [u1, u2, u3] = await Promise.all([
    ngo.sb.from("matches").update({ status: "accepted" }).eq("id", m.id),
    ngo.sb.from("needs").update({
      quantity_received: newReceived,
      status: newReceived >= top.need.quantity_needed ? "fulfilled" : "open",
    }).eq("id", m.need_id),
    ngo.sb.from("resources").update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? "allocated" : "available",
    }).eq("id", m.resource_id),
  ]);
  const { data: needAfter } = await ngo.sb.from("needs").select("quantity_received,status").eq("id", m.need_id).single();
  const { data: resAfter } = await ngo.sb.from("resources").select("quantity_remaining,status").eq("id", m.resource_id).single();
  check("(c4) accept updates quantities & statuses",
    !u1.error && !u2.error && !u3.error &&
    needAfter?.quantity_received === newReceived && resAfter?.quantity_remaining === newRemaining,
    `need received=${needAfter?.quantity_received}, resource remaining=${resAfter?.quantity_remaining} (${resAfter?.status})`);

  // ---- (d) Dashboard data reflects everything ----
  const anon = createClient(URL_, KEY);
  const [probs, needsAll, camps, matches, resources] = await Promise.all([
    anon.from("problems").select("status"),
    anon.from("needs").select("status"),
    anon.from("camps").select("id"),
    anon.from("matches").select("status"),
    anon.from("resources").select("id"),
  ]);
  const c = (rows: { status: string }[] | null, s: string) => rows?.filter((r) => r.status === s).length ?? 0;
  check("(d) dashboard queries return live data",
    (camps.data?.length ?? 0) === 5 &&
    c(probs.data, "resolved") >= 1 &&
    c(matches.data, "accepted") >= 1 &&
    (resources.data?.length ?? 0) >= 1,
    `camps=${camps.data?.length} problems(open/claimed/resolved)=${c(probs.data, "open")}/${c(probs.data, "claimed")}/${c(probs.data, "resolved")} needs(open/fulfilled)=${c(needsAll.data, "open")}/${c(needsAll.data, "fulfilled")} matches accepted=${c(matches.data, "accepted")}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
