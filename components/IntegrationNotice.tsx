"use client";

import type { IntegrationStatus } from "@/lib/useIntegrationStatus";

const code = "bg-ink px-1 text-canvas";

/**
 * Setup banner in the same style as SetupNotice.
 * scope "matching": AI donor matching + WhatsApp (resources, profile pages).
 * scope "posting": moderated posting of problems and answers.
 */
export default function IntegrationNotice({
  status,
  scope = "matching",
}: {
  status: IntegrationStatus | null;
  scope?: "matching" | "posting";
}) {
  if (!status) return null;

  const items: React.ReactNode[] = [];
  if (scope === "matching") {
    if (!status.migration)
      items.push(
        <>
          Database migration not applied — run <code className={code}>supabase/migrations/001_llm_matching_outreach.sql</code>{" "}
          in the Supabase SQL Editor. Donor matching and outreach are unavailable until then.
        </>
      );
    if (!status.llm)
      items.push(
        <>
          No <code className={code}>GEMINI_API_KEY</code> — donors are ranked with the tag-based fallback instead of AI.
        </>
      );
    if (!status.twilio)
      items.push(
        <>
          Twilio not configured — WhatsApp notify is disabled. Add the <code className={code}>TWILIO_*</code> values to{" "}
          <code className={code}>.env.local</code>.
        </>
      );
  } else {
    if (!status.moderation)
      items.push(
        <>
          Database migration not applied — run <code className={code}>supabase/migrations/002_community_qa_moderation.sql</code>{" "}
          in the Supabase SQL Editor. Posting and answers are unavailable until then.
        </>
      );
    if (!status.serviceKey)
      items.push(
        <>
          No <code className={code}>SUPABASE_SERVICE_ROLE_KEY</code> on the server — new posts can&apos;t be saved.
        </>
      );
    if (!status.llm)
      items.push(
        <>
          No <code className={code}>GEMINI_API_KEY</code> — automatic moderation is off, so new posts are{" "}
          {status.failsafeApprove ? "published without review (MODERATION_FAILSAFE=approve)" : "held for a moderator to review"}.
        </>
      );
  }

  if (items.length === 0) return null;
  return (
    <div className="mb-4 border border-dashed border-ink bg-canvas p-4 text-sm text-ink">
      <strong className="font-display">{scope === "matching" ? "AI matching & WhatsApp setup:" : "Posting & moderation setup:"}</strong>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p className="mt-1 text-mute">Setup steps are in the README.</p>
    </div>
  );
}
