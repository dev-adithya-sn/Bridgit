import { URGENCY_LABELS } from "@/lib/types";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-emerald-100 text-emerald-800",
    claimed: "bg-amber-100 text-amber-800",
    resolved: "bg-slate-200 text-slate-600",
    fulfilled: "bg-slate-200 text-slate-600",
    suggested: "bg-blue-100 text-blue-800",
    accepted: "bg-emerald-100 text-emerald-800",
    delivered: "bg-slate-200 text-slate-600",
    declined: "bg-rose-100 text-rose-800",
    available: "bg-emerald-100 text-emerald-800",
    allocated: "bg-slate-200 text-slate-600",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        styles[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: number }) {
  const styles: Record<number, string> = {
    1: "bg-slate-100 text-slate-600",
    2: "bg-sky-100 text-sky-800",
    3: "bg-amber-100 text-amber-800",
    4: "bg-orange-100 text-orange-800",
    5: "bg-rose-100 text-rose-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[urgency]}`}
    >
      {URGENCY_LABELS[urgency]} ({urgency}/5)
    </span>
  );
}
