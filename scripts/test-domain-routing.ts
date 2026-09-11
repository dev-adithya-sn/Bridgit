/**
 * Offline checks for lib/domainClassifier.ts and lib/routing.ts — no
 * database, no dev server. The rejected-key and timeout cases make real
 * calls to the Gemini API (same pattern as test-capability-matching.ts).
 * Run: npx tsx scripts/test-domain-routing.ts
 */
import { classifyDomain, classifyWithKeywords } from "../lib/domainClassifier";
import { rankWithTags, routeProblem, validateRanking, InstitutionCandidate } from "../lib/routing";
import { AiUnavailable } from "../lib/gemini";
import type { Problem } from "../lib/types";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

const problem: Problem = {
  id: "BI-test",
  title: "Village primary school has no usable classroom",
  description: "The only classroom collapsed after last month's rain. 40 students and 2 teachers now hold class under a tree.",
  category: "Education",
  district: "Ranchi",
  ward: null,
  lat: null,
  lng: null,
  urgency: 4,
  population_affected: 40,
  status: "open",
  posted_by: "u-citizen",
  poster_name: "Demo Citizen",
  claimed_by: null,
  claimed_by_name: null,
  solution: null,
  created_at: new Date().toISOString(),
  domain: "Education",
};

const institutions: InstitutionCandidate[] = [
  { id: "inst-edu", name: "Ranchi Institute of Technology", district: "Ranchi", domains: ["Education", "Urban Development"], description: "Runs a student incubation cell and community-teaching outreach.", hasIncubationCell: true },
  { id: "inst-water", name: "Dhanbad Water Institute", district: "Dhanbad", domains: ["Water Resources"], description: "Groundwater recharge and water-quality testing only.", hasIncubationCell: false },
  { id: "inst-edu-far", name: "Simdega Teachers College", district: "Simdega", domains: ["Education"], description: "Teacher training college.", hasIncubationCell: false },
];

async function main() {
  // ---- keyword domain classification (no API key needed) ----
  const kw = classifyWithKeywords(problem.title, problem.description);
  check("keyword classifier picks Education", kw.domain === "Education", JSON.stringify(kw));

  const kwNoMatch = classifyWithKeywords("xyz", "abc");
  check("keyword classifier returns null when nothing matches", kwNoMatch.domain === null);

  const noKey = await classifyDomain({ title: problem.title, description: problem.description, apiKey: undefined });
  check("classifyDomain falls back to keyword when no API key", noKey.method === "keyword" && noKey.domain === "Education", JSON.stringify(noKey));

  const badKey = await classifyDomain({ title: problem.title, description: problem.description, apiKey: "invalid-key-for-testing" });
  check("classifyDomain falls back on a rejected key (real API call)", badKey.domain === "Education", JSON.stringify(badKey));

  // ---- validateRanking defensive parsing ----
  const valid = validateRanking(
    {
      matches: [
        { institution_id: "inst-water", confidence: 20, reasoning: "Unrelated to schools." },
        { institution_id: "inst-edu", confidence: 140, reasoning: "Runs an incubation cell and teaching outreach." },
        { institution_id: "inst-unknown", confidence: 99, reasoning: "Invented institution." },
        { institution_id: "inst-edu", confidence: 10, reasoning: "Duplicate." },
      ],
    },
    institutions
  );
  check("validate: unknown ids dropped", !valid.some((m) => m.institutionId === "inst-unknown"));
  check("validate: duplicates dropped", valid.filter((m) => m.institutionId === "inst-edu").length === 1);
  check("validate: confidence clamped to 100", valid.find((m) => m.institutionId === "inst-edu")?.confidence === 100);
  check("validate: sorted by confidence", valid[0].institutionId === "inst-edu");

  let threw = false;
  try {
    validateRanking({ matches: "not an array" }, institutions);
  } catch (e) {
    threw = e instanceof AiUnavailable;
  }
  check("validate: malformed JSON shape throws AiUnavailable", threw);

  // ---- tag-based fallback ----
  const tags = rankWithTags(problem, institutions);
  check("tags: same-district Education institution ranks first", tags[0]?.institutionId === "inst-edu", JSON.stringify(tags));
  check("tags: unrelated Water Resources institution excluded", !tags.some((m) => m.institutionId === "inst-water"));
  check("tags: far Education institution still included, lower", tags.some((m) => m.institutionId === "inst-edu-far") && tags[0].institutionId !== "inst-edu-far");

  const problemNoDomain: Problem = { ...problem, domain: null };
  check("tags: no domain on the problem → no tag matches", rankWithTags(problemNoDomain, institutions).length === 0);

  // ---- orchestrator fallback triggers ----
  const noApiKey = await routeProblem({ problem, institutions, apiKey: undefined });
  check("fallback: no API key → tag path", noApiKey.method === "tag" && noApiKey.matches[0]?.institutionId === "inst-edu", noApiKey.fallbackReason);

  const badApiKey = await routeProblem({ problem, institutions, apiKey: "invalid-key-for-testing" });
  check("fallback: rejected key (real API call) → tag path", badApiKey.method === "tag", badApiKey.fallbackReason);

  const timeout = await routeProblem({ problem, institutions, apiKey: "invalid-key-for-testing", timeoutMs: 1 });
  check("fallback: timeout (real API call, 1ms) → tag path", timeout.method === "tag" && /timed out|reach/.test(timeout.fallbackReason ?? ""), timeout.fallbackReason);

  const noInstitutions = await routeProblem({ problem, institutions: [], apiKey: "test" });
  check("no institutions registered → empty tag result, no API call", noInstitutions.method === "tag" && noInstitutions.matches.length === 0, noInstitutions.fallbackReason);

  const llmSuccess = await routeProblem({
    problem,
    institutions,
    apiKey: "test",
    ranker: async () => validateRanking({ matches: [{ institution_id: "inst-edu", confidence: 91, reasoning: "Direct domain and district match." }] }, institutions),
  });
  check("success: valid model output → llm path with reasoning", llmSuccess.method === "llm" && llmSuccess.matches[0].reasoning.includes("district match"));

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
