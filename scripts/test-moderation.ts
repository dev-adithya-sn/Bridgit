/**
 * Offline checks for lib/moderation.ts — no database or API key needed.
 * The rejected-key and timeout cases make real calls to the Gemini API.
 * Run: npx tsx scripts/test-moderation.ts
 */
import { moderateContent, validateVerdict } from "../lib/moderation";
import { AiUnavailable } from "../lib/gemini";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

const post = { text: "The ration shop in Ward 7 has been closed for three weeks.", kind: "problem" as const };

async function main() {
  // ---- verdict validation ----
  check("validate: good verdict accepted", validateVerdict({ verdict: "approved", reasoning: "Civic complaint." }).verdict === "approved");
  for (const bad of [{ verdict: "maybe", reasoning: "x" }, { reasoning: "missing verdict" }, "not json", null]) {
    let threw = false;
    try {
      validateVerdict(bad);
    } catch (e) {
      threw = e instanceof AiUnavailable;
    }
    check(`validate: malformed ${JSON.stringify(bad)} rejected`, threw);
  }

  // ---- successful classification passes through ----
  const ok = await moderateContent({
    ...post,
    apiKey: "test",
    classifier: async () => ({ verdict: "rejected", reasoning: "Advertising." }),
  });
  check("llm path: verdict and reasoning passed through", ok.method === "llm" && ok.verdict === "rejected" && ok.reasoning === "Advertising.");

  // ---- fail-safe defaults to "flagged" (held for review) ----
  const noKey = await moderateContent({ ...post, apiKey: "", failsafe: "flag" });
  check("failsafe: no key → flagged", noKey.verdict === "flagged" && noKey.method === "failsafe", noKey.failureReason);

  const badKey = await moderateContent({ ...post, apiKey: "invalid-key-for-testing", failsafe: "flag" });
  check("failsafe: rejected key (real Gemini call) → flagged", badKey.verdict === "flagged", badKey.failureReason);

  const timeout = await moderateContent({ ...post, apiKey: "invalid-key-for-testing", timeoutMs: 1, failsafe: "flag" });
  check("failsafe: timeout (real Gemini call, 1ms) → flagged", timeout.verdict === "flagged" && /timed out/.test(timeout.failureReason ?? ""), timeout.failureReason);

  const malformed = await moderateContent({
    ...post,
    apiKey: "test",
    failsafe: "flag",
    classifier: async () => validateVerdict({ verdict: "definitely-fine" }),
  });
  check("failsafe: malformed model output → flagged", malformed.verdict === "flagged", malformed.failureReason);

  // ---- MODERATION_FAILSAFE=approve flips the default ----
  const demoMode = await moderateContent({ ...post, apiKey: "", failsafe: "approve" });
  check("failsafe=approve: no key → approved", demoMode.verdict === "approved" && demoMode.method === "failsafe");

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
