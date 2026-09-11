"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DonorMatch, MatchNeedResponse } from "@/lib/types";

type NotifyState = { state: "sending" | "sent" | "failed"; error?: string };

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Ranked donor matches for a freshly posted need, with the AI's reasoning,
 * and a WhatsApp notify action for the donors the poster picks.
 */
export default function DonorMatchPanel({
  needId,
  needLabel,
  twilioReady,
  onClose,
}: {
  needId: string;
  needLabel: string;
  twilioReady: boolean;
  onClose: () => void;
}) {
  const [result, setResult] = useState<MatchNeedResponse | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState<Record<string, NotifyState>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/match-need", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ needId }),
      });
      const json = await res.json().catch(() => ({ error: "Unexpected response from the server." }));
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "Could not rank donors.");
        return;
      }
      const data = json as MatchNeedResponse;
      setResult(data);
      // Pre-select the top three donors we can actually reach
      setSelected(new Set(data.matches.filter((m) => m.hasPhone).slice(0, 3).map((m) => m.donorId)));
    })();
    return () => {
      cancelled = true;
    };
  }, [needId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function notifySelected() {
    if (!result) return;
    setSending(true);
    const headers = await authHeaders();
    for (const m of result.matches.filter((x) => selected.has(x.donorId))) {
      setNotify((prev) => ({ ...prev, [m.donorId]: { state: "sending" } }));
      const res = await fetch("/api/notify", {
        method: "POST",
        headers,
        body: JSON.stringify({
          needId,
          donorProfileId: m.donorId,
          confidence: m.confidence,
          reasoning: m.reasoning,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const state: NotifyState =
        res.ok && json.status === "sent"
          ? { state: "sent" }
          : { state: "failed", error: json.error ?? "Send failed." };
      setNotify((prev) => ({ ...prev, [m.donorId]: state }));
    }
    setSending(false);
  }

  const reachableSelected = result?.matches.filter((m) => selected.has(m.donorId) && m.hasPhone).length ?? 0;

  return (
    <section className="mb-6 border-2 border-ink bg-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-5 py-3 text-canvas">
        <div>
          <h2 className="font-display text-lg font-bold">Donor matches</h2>
          <p className="text-xs text-canvas/70">For: {needLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {result &&
            (result.method === "llm" ? (
              <span className="bg-canvas px-2 py-0.5 font-display text-xs font-bold text-ink">
                AI-ranked · Gemini
              </span>
            ) : (
              <span className="border border-dashed border-canvas px-2 py-0.5 font-display text-xs font-bold">
                Tag-based fallback
              </span>
            ))}
          <button onClick={onClose} className="text-sm text-canvas/70 hover:text-canvas" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <div className="p-5">
        {result?.method === "tag" && result.fallbackReason && (
          <p className="mb-3 text-xs text-mute">AI ranking unavailable: {result.fallbackReason}.</p>
        )}

        {error ? (
          <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>
        ) : !result ? (
          <p className="py-6 text-center text-sm text-mute">Ranking donors by what they can offer…</p>
        ) : result.matches.length === 0 ? (
          <p className="border border-dashed border-mute py-6 text-center text-sm text-mute">
            No donor has described a capability that fits this need yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {result.matches.map((m, i) => (
              <MatchRow
                key={m.donorId}
                rank={i + 1}
                match={m}
                checked={selected.has(m.donorId)}
                onToggle={() => toggle(m.donorId)}
                notify={notify[m.donorId]}
              />
            ))}
          </ol>
        )}

        {result && result.matches.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink pt-4">
            <button
              disabled={!twilioReady || sending || reachableSelected === 0}
              onClick={notifySelected}
              className="bg-ink px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-40"
            >
              {sending ? "Sending…" : `Notify selected via WhatsApp (${reachableSelected})`}
            </button>
            {!twilioReady && (
              <span className="text-xs text-mute">WhatsApp is disabled until Twilio is configured.</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MatchRow({
  rank,
  match,
  checked,
  onToggle,
  notify,
}: {
  rank: number;
  match: DonorMatch;
  checked: boolean;
  onToggle: () => void;
  notify?: NotifyState;
}) {
  return (
    <li className="border border-ink p-4">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked && match.hasPhone}
          disabled={!match.hasPhone}
          onChange={onToggle}
          className="mt-1 accent-ink"
          aria-label={`Select ${match.name}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold">
              #{rank} {match.name}
            </span>
            <span className="border border-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              {match.role === "camp" ? "Relief camp" : "NGO"}
            </span>
            {notify && (
              <span
                className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  notify.state === "sent"
                    ? "bg-ink text-canvas"
                    : notify.state === "failed"
                      ? "border border-ink text-ink line-through"
                      : "border border-dashed border-ink text-ink"
                }`}
              >
                {notify.state === "sending" ? "sending…" : `WhatsApp ${notify.state}`}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-mute">Confidence</span>
            <div className="h-2 flex-1 border border-ink">
              <div className="h-full bg-ink" style={{ width: `${match.confidence}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-semibold">{match.confidence}</span>
          </div>

          <p className="mt-2 text-sm italic">&ldquo;{match.reasoning}&rdquo;</p>

          <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-mute">
            {match.email && (
              <a href={`mailto:${match.email}`} className="underline hover:text-ink">
                {match.email}
              </a>
            )}
            {!match.hasPhone && <span>No WhatsApp number on file</span>}
          </div>
          {notify?.state === "failed" && notify.error && <p className="mt-1 text-xs text-ink">{notify.error}</p>}
        </div>
      </div>
    </li>
  );
}
