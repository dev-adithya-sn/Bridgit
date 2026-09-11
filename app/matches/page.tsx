"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Camp, Match, Need, Resource, RESOURCE_TYPES } from "@/lib/types";
import { StatusBadge } from "@/components/Badges";

type FullMatch = Match & { resources: Resource; needs: Need & { camps: Camp } };

function ScoreBar({ label, points, max, color }: {
  label: string; points: number; max: number; color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 text-slate-600">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${color}`}
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
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Smart Matching</h1>
        <p className="text-sm text-slate-600">
          Every supply is scored against every open need —{" "}
          <span className="font-mono">urgency + population ÷ distance</span> — so
          help goes where it&apos;s needed most, not just nearest. The full score
          breakdown is shown for every match.
        </p>
        {resourceFilter && (
          <Link href="/matches" className="mt-1 inline-block text-sm text-blue-700 underline">
            Showing one resource — view all matches
          </Link>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading matches…</p>
      ) : matches.length === 0 ? (
        <div className="py-10 text-center text-slate-500">
          <p>No matches yet.</p>
          <p className="mt-1 text-sm">
            Post supplies on the{" "}
            <Link href="/resources" className="text-blue-700 underline">
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
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!resourceFilter ? null : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          i === 0 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                        }`}>
                          #{i + 1} {i === 0 ? "BEST MATCH" : ""}
                        </span>
                      )}
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-2 font-semibold">
                      Send{" "}
                      <span className="text-blue-700">
                        {m.quantity_allocated.toLocaleString()} {m.resources?.unit}
                      </span>{" "}
                      of {typeLabel(m.resources?.type ?? "")} from{" "}
                      {m.resources?.donor_name ?? "donor"} →{" "}
                      <span className="text-blue-700">{m.needs?.camps?.name}</span>{" "}
                      ({m.needs?.camps?.district})
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-slate-900">
                      {b?.finalScore ?? m.score}
                    </div>
                    <div className="text-xs text-slate-500">match score</div>
                  </div>
                </div>

                {b && (
                  <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3">
                    <ScoreBar
                      label={`Urgency ${b.urgency}/5`}
                      points={b.urgencyPoints} max={60} color="bg-rose-500"
                    />
                    <ScoreBar
                      label={`Population ${b.population.toLocaleString()}`}
                      points={b.populationPoints} max={40} color="bg-blue-500"
                    />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-40 shrink-0 text-slate-600">
                        Distance {b.distanceKm} km
                      </span>
                      <span className="text-slate-500">
                        ÷ {b.distanceFactor} → final score{" "}
                        <strong className="text-slate-900">{b.finalScore}</strong>
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
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Accept match ✓
                        </button>
                        <button
                          disabled={busy === m.id}
                          onClick={() => setStatus(m, "declined")}
                          className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {m.status === "accepted" && (
                      <button
                        disabled={busy === m.id}
                        onClick={() => setStatus(m, "delivered")}
                        className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                      >
                        Mark delivered 🚚
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
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-slate-500">Loading…</p>}>
      <MatchesInner />
    </Suspense>
  );
}
