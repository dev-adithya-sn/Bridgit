"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { postWithSession } from "@/lib/authFetch";
import { useSession } from "@/lib/useSession";
import { useIntegrationStatus } from "@/lib/useIntegrationStatus";
import IntegrationNotice from "@/components/IntegrationNotice";
import { StatusBadge, DomainBadge } from "@/components/Badges";
import type { InstitutionRepresentative, Problem, ProblemRouting } from "@/lib/types";

/** One ranked institution for the problem currently being routed. */
function SuggestionRow({ row }: { row: ProblemRouting }) {
  return (
    <li className="border border-ink bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display font-semibold">{row.institutions?.name ?? "Unknown institution"}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-mute">{row.method === "llm" ? "AI-ranked" : "Tag-matched"}</span>
          <StatusBadge status={row.status} />
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {row.institutions?.domains.map((d) => (
          <span key={d} className="border border-ink px-1.5 py-0.5 text-[10px] uppercase text-mute">
            {d}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm italic text-mute">&ldquo;{row.reasoning}&rdquo;</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink">Confidence: {Math.round(row.confidence)}%</p>
    </li>
  );
}

function ProblemRoutingSection({ problemId }: { problemId: string }) {
  const { session, profile } = useSession();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [rows, setRows] = useState<ProblemRouting[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: p }, { data: r }] = await Promise.all([
      sb.from("problems").select("*").eq("id", problemId).single(),
      sb.from("problem_routing").select("*, institutions(*)").eq("problem_id", problemId).order("confidence", { ascending: false }),
    ]);
    setProblem(p as Problem | null);
    setRows((r as ProblemRouting[]) ?? []);
    setLoaded(true);
  }, [problemId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError("");
    const { status, json } = await postWithSession("/api/route-problem", { problemId });
    setGenerating(false);
    if (status !== 200) {
      setError(json?.error ?? "Could not generate routing suggestions.");
      return;
    }
    load();
  }

  if (!loaded) return <p className="py-6 text-center text-mute">Loading…</p>;
  if (!problem) return <p className="py-6 text-center text-mute">Problem not found.</p>;

  // Mirrors the check inside app/api/route-problem: owner or admin only. The
  // button simply isn't shown to anyone else, rather than showing it and
  // letting the API's 403 be the first they hear of it.
  const canGenerate = !!session && (problem.posted_by === session.user.id || profile?.role === "admin");

  return (
    <section className="border border-ink bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-mute">Routing for</p>
          <Link href={`/problems/${problem.id}`} className="font-display text-lg font-bold hover:underline">
            {problem.title}
          </Link>
          <div className="mt-1 flex flex-wrap gap-2">
            <DomainBadge domain={problem.domain} />
          </div>
        </div>
        {canGenerate && (
          <button
            disabled={generating}
            onClick={generate}
            className="bg-ink px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
          >
            {generating ? "Ranking institutions…" : rows.length > 0 ? "Regenerate suggestions" : "Generate routing suggestions"}
          </button>
        )}
      </div>
      {error && <p className="mt-3 bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
      {rows.length === 0 ? (
        <p className="mt-4 border border-dashed border-mute p-6 text-center text-sm text-mute">
          {canGenerate ? "No suggestions yet — generate some above." : "No routing suggestions yet."}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <SuggestionRow key={r.id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Your own problems, so you can jump into routing without needing the link from the detail page. */
function MyProblemsPicker() {
  const { session } = useSession();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase()
      .from("problems")
      .select("*")
      .eq("posted_by", session.user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProblems((data as Problem[]) ?? []);
        setLoaded(true);
      });
  }, [session]);

  if (!session) return null;
  if (!loaded) return <p className="text-sm text-mute">Loading your problems…</p>;
  if (problems.length === 0) return <p className="text-sm text-mute">You haven&apos;t reported any problems yet.</p>;

  return (
    <ul className="space-y-2">
      {problems.map((p) => (
        <li key={p.id}>
          <Link href={`/routing?problem=${p.id}`} className="block border border-ink bg-canvas p-3 text-sm hover:bg-ink hover:text-canvas">
            <span className="font-semibold">{p.title}</span>
            <span className="ml-2 text-xs uppercase text-mute">{p.domain ?? "no domain yet"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Institutions queue: suggestions targeting institutions the viewer
 * represents (or, for an admin, every institution). Accept/decline buttons
 * are the actual UI for the server-side check in
 * app/api/route-problem/respond — a row for an institution you're not a
 * *verified* representative of renders with no buttons at all, matching
 * what the API would refuse anyway.
 */
function InstitutionQueue() {
  const { session, profile } = useSession();
  const [rows, setRows] = useState<ProblemRouting[]>([]);
  const [myReps, setMyReps] = useState<InstitutionRepresentative[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    if (!session) return;
    const sb = supabase();

    if (isAdmin) {
      const { data } = await sb
        .from("problem_routing")
        .select("*, institutions(*), problems(*)")
        .eq("status", "suggested")
        .order("confidence", { ascending: false });
      setRows((data as ProblemRouting[]) ?? []);
      setLoaded(true);
      return;
    }

    // Self-read only, per supabase/migrations/004 — this is the caller's own
    // membership, verified or not, in every institution they've registered for.
    const { data: reps } = await sb
      .from("institution_representatives")
      .select("*, institutions(*)")
      .eq("profile_id", session.user.id);
    const myRows = (reps as InstitutionRepresentative[]) ?? [];
    setMyReps(myRows);

    const institutionIds = myRows.map((r) => r.institution_id);
    if (institutionIds.length === 0) {
      setRows([]);
      setLoaded(true);
      return;
    }
    const { data } = await sb
      .from("problem_routing")
      .select("*, institutions(*), problems(*)")
      .eq("status", "suggested")
      .in("institution_id", institutionIds)
      .order("confidence", { ascending: false });
    setRows((data as ProblemRouting[]) ?? []);
    setLoaded(true);
  }, [session, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(routingId: string, status: "accepted" | "declined") {
    setBusy(routingId);
    setError("");
    const { status: http, json } = await postWithSession("/api/route-problem/respond", { routingId, status });
    setBusy(null);
    if (http !== 200) {
      setError(json?.error ?? "Could not update this suggestion.");
      return;
    }
    load();
  }

  if (!session) return null;
  if (!loaded) return <p className="text-sm text-mute">Loading…</p>;

  if (!isAdmin && myReps.length === 0) {
    return (
      <p className="border border-dashed border-mute p-6 text-center text-sm text-mute">
        You&apos;re not registered as a representative of any institution.{" "}
        <Link href="/signup" className="underline">
          Register one
        </Link>{" "}
        or ask your institution&apos;s admin to add you.
      </p>
    );
  }

  const verifiedInstitutionIds = new Set(myReps.filter((r) => r.verified).map((r) => r.institution_id));

  return (
    <div>
      {error && <p className="mb-3 bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
      {!isAdmin && myReps.some((r) => !r.verified) && (
        <p className="mb-4 border border-dashed border-ink bg-canvas p-3 text-sm text-mute">
          {myReps.filter((r) => !r.verified).map((r) => r.institutions?.name).join(", ")}: you&apos;re registered but
          not yet <strong className="text-ink">verified</strong> — suggestions for {myReps.filter((r) => !r.verified).length === 1 ? "it" : "them"} are
          listed below with no Accept/Decline buttons until an admin confirms you.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="border border-dashed border-mute p-6 text-center text-sm text-mute">No pending suggestions.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const canRespond = isAdmin || verifiedInstitutionIds.has(r.institution_id);
            return (
              <li key={r.id} className="border border-ink bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-mute">For institution</p>
                    <p className="font-display font-semibold">{r.institutions?.name}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide">{Math.round(r.confidence)}% confidence</span>
                </div>
                <Link href={`/problems/${r.problem_id}`} className="mt-2 block text-sm font-semibold text-ink underline underline-offset-2">
                  {r.problems?.title ?? "View problem"}
                </Link>
                <p className="mt-1 text-sm italic text-mute">&ldquo;{r.reasoning}&rdquo;</p>
                {canRespond ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={busy === r.id}
                      onClick={() => respond(r.id, "accepted")}
                      className="bg-ink px-3 py-1.5 font-display text-xs font-semibold uppercase text-canvas hover:bg-ink/80 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      disabled={busy === r.id}
                      onClick={() => respond(r.id, "declined")}
                      className="border border-ink px-3 py-1.5 font-display text-xs font-semibold uppercase hover:bg-ink hover:text-canvas disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs uppercase tracking-wide text-mute">
                    Awaiting verification — you can&apos;t accept or decline yet.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RoutingPageInner() {
  const { session, loading } = useSession();
  const integrations = useIntegrationStatus();
  const params = useSearchParams();
  const problemId = params.get("problem");

  if (loading) return <p className="py-10 text-center text-mute">Loading…</p>;
  if (!session) {
    return (
      <p className="py-10 text-center text-mute">
        <Link href="/login" className="font-semibold text-ink underline">
          Log in
        </Link>{" "}
        to view domain routing.
      </p>
    );
  }

  return (
    <div>
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="font-display text-3xl font-bold">Domain routing</h1>
          <p className="text-sm text-canvas/70">
            Match citizen-reported problems to the institutions best placed to work on them.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <IntegrationNotice status={integrations} scope="routing" />

        {problemId ? (
          <ProblemRoutingSection problemId={problemId} />
        ) : (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Your problems</h2>
            <p className="mb-3 text-sm text-mute">Pick one to generate or view its routing suggestions.</p>
            <MyProblemsPicker />
          </section>
        )}

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Suggestions for your institution</h2>
          <InstitutionQueue />
        </section>
      </div>
    </div>
  );
}

export default function RoutingPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-mute">Loading…</p>}>
      <RoutingPageInner />
    </Suspense>
  );
}
