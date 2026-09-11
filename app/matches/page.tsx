"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Camp, Match, Need, Resource, RESOURCE_TYPES } from "@/lib/types";
import { StatusBadge } from "@/components/Badges";

type FullMatch = Match & { resources: Resource; needs: Need & { camps: Camp } };

function ScoreBar({ label, points, max, solid }: {
  label: string; points: number; max: number; solid?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 text-mute">{label}</span>
      <div className="h-2 flex-1 border border-ink bg-canvas">
        <div
          className={`h-full ${solid ? "bg-ink" : "bg-mute"}`}
          style={{ width: `${Math.min(100, (points / max) * 100)}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right font-semibold">{points}</span>
    </div>
  );
}

function MatchesInner() {
  const params = useSearchParams();
  const resourceFilter = params.get("resource");
  const { session } = useSession();
  const [matches, setMatches] = useState<FullMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    let q = supabase()
      .from("matches")
      .select("*, resources(*), needs(*, camps(*))")
      .order("score", { ascending: false });
    if (resourceFilter) q = q.eq("resource_id", resourceFilter);
    const { data } = await q;
    setMatches((data as FullMatch[]) ?? []);
    setLoading(false);
  }, [resourceFilter]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  /** Accepting a match moves real quantities: need receives, resource depletes. */
  async function accept(m: FullMatch) {
    setBusy(m.id);
    setError("");
    const sb = supabase();
    const newReceived = m.needs.quantity_received + m.quantity_allocated;
    const newRemaining = Math.max(0, m.resources.quantity_remaining - m.quantity_allocated);
    const results = await Promise.all([
      sb.from("matches").update({ status: "accepted" }).eq("id", m.id),
      sb.from("needs").update({
        quantity_received: newReceived,
        status: newReceived >= m.needs.quantity_needed ? "fulfilled" : "open",
      }).eq("id", m.need_id),
      sb.from("resources").update({
        quantity_remaining: newRemaining,
        status: newRemaining === 0 ? "allocated" : "available",
      }).eq("id", m.resource_id),
    ]);
    setBusy(null);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) setError(firstError.message);
    load();
  }

  async function setStatus(m: FullMatch, status: string) {
    setBusy(m.id);
    await supabase().from("matches").update({ status }).eq("id", m.id);
    setBusy(null);
    load();
  }

  const typeLabel = (v: string) =>
    RESOURCE_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <div>
      {/* Full-width black band */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="font-display text-3xl font-bold">Smart Matching</h1>
          <p className="text-sm text-canvas/70">
            Every supply is scored against every open need —{" "}
            <span className="font-mono text-canvas">urgency + population ÷ distance</span> — so
            help goes where it&apos;s needed most, not just nearest. The full score
            breakdown is shown for every match.
          </p>
          {resourceFilter && (
            <Link href="/matches" className="mt-1 inline-block text-sm text-canvas underline">
              Showing one resource — view all matches
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {error && <p className="mb-3 bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}

        {loading ? (
          <p className="py-10 text-center text-mute">Loading matches…</p>
        ) : matches.length === 0 ? (
          <div className="border border-dashed border-mute py-10 text-center text-mute">
            <p>No matches yet.</p>
            <p className="mt-1 text-sm">
              Post supplies on the{" "}
              <Link href="/resources" className="text-ink underline">
                Resources &amp; Needs
              </Link>{" "}
              page and the matcher will run instantly.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((m, i) => {
              const b = m.score_breakdown;
              return (
                <div key={m.id} className="border border-ink bg-canvas p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!resourceFilter ? null : (
                          <span className={`px-2 py-0.5 font-display text-xs font-bold uppercase ${
                            i === 0 ? "bg-ink text-canvas" : "border border-mute text-mute"
                          }`}>
                            #{i + 1} {i === 0 ? "BEST MATCH" : ""}
                          </span>
                        )}
                        <StatusBadge status={m.status} />
                      </div>
                      <p className="mt-2 font-semibold">
                        Send{" "}
                        <span className="underline underline-offset-2">
                          {m.quantity_allocated.toLocaleString()} {m.resources?.unit}
                        </span>{" "}
                        of {typeLabel(m.resources?.type ?? "")} from{" "}
                        {m.resources?.donor_name ?? "donor"} →{" "}
                        <span className="underline underline-offset-2">{m.needs?.camps?.name}</span>{" "}
                        ({m.needs?.camps?.district})
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-3xl font-bold">
                        {b?.finalScore ?? m.score}
                      </div>
                      <div className="text-xs uppercase text-mute">match score</div>
                    </div>
                  </div>

                  {b && (
                    <div className="mt-4 space-y-1.5 border border-ink p-3">
                      <ScoreBar
                        label={`Urgency ${b.urgency}/5`}
                        points={b.urgencyPoints} max={60} solid
                      />
                      <ScoreBar
                        label={`Population ${b.population.toLocaleString()}`}
                        points={b.populationPoints} max={40}
                      />
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-40 shrink-0 text-mute">
                          Distance {b.distanceKm} km
                        </span>
                        <span className="text-mute">
                          ÷ {b.distanceFactor} → final score{" "}
                          <strong className="text-ink">{b.finalScore}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {session && (
                    <div className="mt-4 flex gap-2">
                      {m.status === "suggested" && (
                        <>
                          <button
                            disabled={busy === m.id}
                            onClick={() => accept(m)}
                            className="bg-ink px-4 py-1.5 font-display text-sm font-semibold uppercase text-canvas hover:bg-ink/80 disabled:opacity-50"
                          >
                            Accept match ✓
                          </button>
                          <button
                            disabled={busy === m.id}
                            onClick={() => setStatus(m, "declined")}
                            className="border border-ink px-4 py-1.5 font-display text-sm font-semibold uppercase text-ink hover:bg-ink hover:text-canvas disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {m.status === "accepted" && (
                        <button
                          disabled={busy === m.id}
                          onClick={() => setStatus(m, "delivered")}
                          className="border border-ink px-4 py-1.5 font-display text-sm font-semibold uppercase text-ink hover:bg-ink hover:text-canvas disabled:opacity-50"
                        >
                          Mark delivered
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-mute">Loading…</p>}>
      <MatchesInner />
    </Suspense>
  );
}
