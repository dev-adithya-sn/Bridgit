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
