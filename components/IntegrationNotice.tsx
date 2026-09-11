"use client";

import type { IntegrationStatus } from "@/lib/useIntegrationStatus";

/** Setup banner for AI matching + WhatsApp, in the same style as SetupNotice. */
export default function IntegrationNotice({ status }: { status: IntegrationStatus | null }) {
  if (!status || (status.migration && status.llm && status.twilio)) return null;
  return (
    <div className="mb-4 border border-dashed border-ink bg-canvas p-4 text-sm text-ink">
      <strong className="font-display">AI matching &amp; WhatsApp setup:</strong>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {!status.migration && (
          <li>
            Database migration not applied — run{" "}
            <code className="bg-ink px-1 text-canvas">supabase/migrations/001_llm_matching_outreach.sql</code>{" "}
            in the Supabase SQL Editor. Donor matching and outreach are unavailable until then.
          </li>
        )}
        {!status.llm && (
          <li>
            No <code className="bg-ink px-1 text-canvas">ANTHROPIC_API_KEY</code> — donors are ranked with the
            tag-based fallback instead of AI.
          </li>
        )}
        {!status.twilio && (
          <li>
            Twilio not configured — WhatsApp notify is disabled. Add the{" "}
            <code className="bg-ink px-1 text-canvas">TWILIO_*</code> values to{" "}
            <code className="bg-ink px-1 text-canvas">.env.local</code>.
          </li>
        )}
      </ul>
      <p className="mt-1 text-mute">Setup steps are in the README.</p>
    </div>
  );
}
