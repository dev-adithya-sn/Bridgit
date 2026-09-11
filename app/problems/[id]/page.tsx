"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Problem, ProblemRouting } from "@/lib/types";
import { DomainBadge, ModerationBadge, StatusBadge, UrgencyBadge } from "@/components/Badges";
import AnswersThread from "@/components/AnswersThread";
import MapView from "@/components/MapView";

export default function ProblemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, profile } = useSession();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [routing, setRouting] = useState<ProblemRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [solution, setSolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data }, { data: routingRows }] = await Promise.all([
      sb.from("problems").select("*").eq("id", id).single(),
      sb.from("problem_routing").select("*, institutions(*)").eq("problem_id", id).order("confidence", { ascending: false }),
    ]);
    setProblem(data as Problem | null);
    setRouting((routingRows as ProblemRouting[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    load();
  }, [load]);

  async function update(fields: Partial<Problem>) {
    setBusy(true);
    setError("");
    const { error } = await supabase()
      .from("problems")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <p className="py-10 text-center text-mute">Loading…</p>;
  if (!problem)
    return (
      <p className="py-10 text-center text-mute">
        Problem not found.{" "}
        <Link href="/problems" className="text-ink underline">
          Back to board
        </Link>
      </p>
    );

  const isTeam = profile?.role === "university_team";
  const isPosterOrAdmin =
    (session && problem.posted_by === session.user.id) || profile?.role === "admin";
  const isClaimer = session && problem.claimed_by === session.user.id;

  return (
    <div>
      {/* Black title band */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <Link href="/problems" className="text-sm text-canvas/60 hover:text-canvas">
            ← Back to Problem Board
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight">{problem.title}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="border border-ink bg-canvas p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={problem.status} />
            <UrgencyBadge urgency={problem.urgency} />
            <DomainBadge domain={problem.domain} />
            <ModerationBadge status={problem.moderation_status} />
          </div>
          {problem.moderation_status && problem.moderation_status !== "approved" && (
            <p className="mt-2 border-l border-ink pl-3 text-sm text-mute">
              {problem.moderation_status === "pending"
                ? "Only you and moderators can see this until it's approved."
                : "A moderator rejected this post, so it isn't public."}
              {problem.moderation_reason ? ` Reason: ${problem.moderation_reason}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm uppercase text-mute">
            <span>{problem.district}{problem.ward ? ` · ${problem.ward}` : ""}</span>
            <span>{problem.category}</span>
            <span>~{problem.population_affected.toLocaleString()} affected</span>
            {problem.poster_name && <span>posted by {problem.poster_name}</span>}
          </div>
          <p className="mt-4 whitespace-pre-wrap">{problem.description}</p>

          {problem.lat != null && problem.lng != null && (
            <div className="mt-4">
              <MapView
                height="280px"
                center={[problem.lat, problem.lng]}
                zoom={12}
                markers={[{
                  id: problem.id,
                  lat: problem.lat,
                  lng: problem.lng,
                  color: "#171512",
                  label: String(problem.urgency),
                }]}
              />
            </div>
          )}

          {problem.status !== "open" && (
            <div className="mt-5 border border-ink p-4 text-sm">
              <p>
                <strong>Claimed by:</strong> {problem.claimed_by_name ?? "a university team"}
              </p>
              {problem.solution && (
                <p className="mt-2 whitespace-pre-wrap">
                  <strong>Proposed solution:</strong> {problem.solution}
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-3 bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}

          {/* Actions by role and status */}
          <div className="mt-5 space-y-4">
            {!session && problem.status === "open" && (
              <p className="text-sm text-mute">
                <Link href="/login" className="font-semibold text-ink underline">
                  Log in
                </Link>{" "}
                as a university team to claim this problem.
              </p>
            )}

            {problem.status === "open" && isTeam && (
              <button
                disabled={busy}
                onClick={() =>
                  update({
                    status: "claimed",
                    claimed_by: session!.user.id,
                    claimed_by_name: profile?.org_name || profile?.full_name || "University team",
                  })
                }
                className="bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
              >
                Claim this problem
              </button>
            )}

            {problem.status === "claimed" && isClaimer && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  update({ solution });
                }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium">
                  {problem.solution ? "Update your solution" : "Submit your solution"}
                </label>
                <textarea
                  required
                  rows={4}
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="Describe your team's solution: what you'll do, resources needed, timeline…"
                  className="w-full border border-ink bg-white px-3 py-2 outline-none"
                />
                <button
                  disabled={busy}
                  className="bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
                >
                  Submit solution
                </button>
              </form>
            )}

            {problem.status === "claimed" && problem.solution && (isPosterOrAdmin || isClaimer) && (
              <button
                disabled={busy}
                onClick={() => update({ status: "resolved" })}
                className="border border-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-ink hover:bg-ink hover:text-canvas disabled:opacity-50"
              >
                Mark as resolved ✓
              </button>
            )}
          </div>
        </div>

        {/* Domain routing summary — the full generate/accept/decline UI lives at /routing */}
        <div className="mt-6 border border-ink bg-canvas p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Institution routing</h2>
            <Link
              href={`/routing?problem=${problem.id}`}
              className="text-sm font-semibold text-ink underline underline-offset-2"
            >
              {routing.length > 0 ? "Manage routing →" : "Generate routing suggestions →"}
            </Link>
          </div>
          {routing.length === 0 ? (
            <p className="mt-2 text-sm text-mute">No institutions have been suggested for this problem yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {routing.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border border-ink p-3 text-sm">
                  <span className="font-semibold">{r.institutions?.name ?? "Unknown institution"}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs uppercase text-mute">{Math.round(r.confidence)}% confidence</span>
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AnswersThread problemId={problem.id} />
      </div>
    </div>
  );
}
