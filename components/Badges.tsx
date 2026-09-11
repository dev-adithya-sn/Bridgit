import { URGENCY_LABELS } from "@/lib/types";

// Monochrome: status reads through weight, not hue.
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "border-ink bg-ink text-canvas",
    claimed: "border-ink text-ink",
    resolved: "border-mute text-mute line-through",
    fulfilled: "border-mute text-mute line-through",
    suggested: "border-ink border-dashed text-ink",
    accepted: "border-ink bg-ink text-canvas",
    delivered: "border-mute text-mute",
    declined: "border-mute text-mute line-through",
    available: "border-ink bg-ink text-canvas",
    allocated: "border-mute text-mute",
  };
  return (
    <span
      className={`inline-block border px-2.5 py-0.5 text-xs font-semibold uppercase ${
        styles[status] ?? "border-mute text-mute"
      }`}
    >
      {status}
    </span>
  );
}

/** Shown only on posts that aren't public yet (their author and admins see them). */
export function ModerationBadge({ status }: { status?: string }) {
  if (!status || status === "approved") return null;
  return (
    <span
      className={`inline-block border px-2.5 py-0.5 text-xs font-semibold uppercase ${
        status === "rejected" ? "border-ink bg-ink text-canvas" : "border-dashed border-ink text-ink"
      }`}
    >
      {status === "rejected" ? "Rejected by moderator" : "Under review"}
    </span>
  );
}

/** Shown once a problem has a classified domain (supabase/migrations/003). */
export function DomainBadge({ domain }: { domain?: string | null }) {
  if (!domain) return null;
  return (
    <span className="inline-block border border-dashed border-ink px-2.5 py-0.5 text-xs font-semibold uppercase text-ink">
      {domain}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: number }) {
  const styles: Record<number, string> = {
    1: "border-mute text-mute",
    2: "border-mute text-ink",
    3: "border-ink text-ink",
    4: "border-ink text-ink font-bold",
    5: "border-ink bg-ink text-canvas",
  };
  return (
    <span
      className={`inline-block border px-2.5 py-0.5 text-xs font-semibold uppercase ${styles[urgency]}`}
    >
      {URGENCY_LABELS[urgency]} ({urgency}/5)
    </span>
  );
}
