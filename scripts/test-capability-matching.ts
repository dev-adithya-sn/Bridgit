/**
 * Offline checks for lib/capabilityMatching.ts — no database needed.
 * Covers output validation, the tag-based fallback, and every fallback
 * trigger (no key, rejected key, timeout, malformed / empty model output).
 * The rejected-key and timeout cases make real calls to the Anthropic API.
 * Run: npx tsx scripts/test-capability-matching.ts
 */
import { matchNeed, rankWithTags, validateRanking, LlmFallback, Donor, NeedWithCamp } from "../lib/capabilityMatching";
import type { Resource } from "../lib/types";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

const need: NeedWithCamp = {
  id: "need-1",
  camp_id: "camp-1",
  type: "medicine",
  quantity_needed: 200,
  quantity_received: 0,
  unit: "first-aid kits",
  urgency: 5,
  status: "open",
  description: "Elderly residents have run out of blood-pressure medicines; access road partly flooded.",
  created_at: new Date().toISOString(),
  camps: { id: "camp-1", name: "Sahibganj Riverside Camp", district: "Sahibganj", lat: 25.2425, lng: 87.647, population: 3400, contact: null },
};

const donors: Donor[] = [
  { id: "d-pharmacy", name: "Jan Aushadhi Seva Pharmacy", role: "ngo", email: "pharmacy@example.com", capability: "We run a pharmacy and can supply basic medicines, bandages and first-aid kits. We have a van.", hasPhone: true },
  { id: "d-boats", name: "Ganga Boat Rescue Volunteers", role: "ngo", email: null, capability: "Six motor boats for ferrying supplies to flooded villages.", hasPhone: false },
  { id: "d-kitchen", name: "Annapurna Community Kitchen", role: "ngo", email: null, capability: "We cook 2,000 hot meals a day.", hasPhone: true },
];

const resources: Resource[] = [
  { id: "r1", type: "medicine", quantity: 150, quantity_remaining: 150, unit: "first-aid kits", district: "Ranchi", lat: 23.3441, lng: 85.3096, posted_by: "d-pharmacy", donor_name: "Jan Aushadhi Seva Pharmacy", status: "available", created_at: "" },
];

async function main() {
  // ---- validateRanking ----
  const valid = validateRanking(
    {
      matches: [
        { donor_id: "d-boats", confidence: 70, reasoning: "Boats can reach the flooded camp." },
        { donor_id: "d-pharmacy", confidence: 140, reasoning: "Pharmacy stocks medicines." },
        { donor_id: "d-unknown", confidence: 99, reasoning: "Invented donor." },
        { donor_id: "d-boats", confidence: 10, reasoning: "Duplicate." },
      ],
    },
    donors
  );
  check("validate: unknown ids dropped", !valid.some((m) => m.donorId === "d-unknown"));
  check("validate: duplicates dropped", valid.filter((m) => m.donorId === "d-boats").length === 1);
  check("validate: confidence clamped to 100", valid.find((m) => m.donorId === "d-pharmacy")?.confidence === 100);
  check("validate: sorted by confidence", valid[0].donorId === "d-pharmacy");
  check("validate: phone numbers never present", valid.every((m) => !("phone" in m)));

  let threw = false;
  try {
    validateRanking({ matches: "not an array" }, donors);
  } catch (e) {
    threw = e instanceof LlmFallback;
  }
  check("validate: malformed JSON shape throws LlmFallback", threw);

  // ---- tag-based fallback (uses lib/matching.ts scoreNeed) ----
  const tags = rankWithTags(need, donors, resources);
  check("tags: donor with posted stock ranks first", tags[0]?.donorId === "d-pharmacy", tags[0]?.reasoning);
  check("tags: unrelated donor excluded", !tags.some((m) => m.donorId === "d-kitchen"));

  // ---- orchestrator fallback triggers ----
  const noKey = await matchNeed({ need, donors, resources, apiKey: undefined });
  check("fallback: no API key → tag path", noKey.method === "tag" && /not set/.test(noKey.fallbackReason ?? ""), noKey.fallbackReason);

  const badKey = await matchNeed({ need, donors, resources, apiKey: "sk-ant-invalid-key-for-testing" });
  check("fallback: rejected key (real API call) → tag path", badKey.method === "tag" && badKey.matches.length > 0, badKey.fallbackReason);

  const timeout = await matchNeed({ need, donors, resources, apiKey: "sk-ant-invalid-key-for-testing", timeoutMs: 1 });
  check("fallback: timeout (real API call, 1ms) → tag path", timeout.method === "tag" && /timed out|reach/.test(timeout.fallbackReason ?? ""), timeout.fallbackReason);

  const malformed = await matchNeed({
    need, donors, resources, apiKey: "test",
    ranker: async () => validateRanking({ nonsense: true }, donors),
  });
  check("fallback: malformed model output → tag path", malformed.method === "tag", malformed.fallbackReason);

  const empty = await matchNeed({ need, donors, resources, apiKey: "test", ranker: async () => [] });
  check("fallback: empty model output → tag path", empty.method === "tag", empty.fallbackReason);

  const llm = await matchNeed({
    need, donors, resources, apiKey: "test",
    ranker: async () => validateRanking({ matches: [{ donor_id: "d-pharmacy", confidence: 92, reasoning: "Stocks medicines." }] }, donors),
  });
  check("success: valid model output → llm path with reasoning", llm.method === "llm" && llm.matches[0].reasoning === "Stocks medicines.");

  const noDonors = await matchNeed({ need, donors: [], resources, apiKey: "test" });
  check("no donors → empty tag result, no API call", noDonors.method === "tag" && noDonors.matches.length === 0, noDonors.fallbackReason);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
