"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { Answer, ModerationStatus, Problem } from "@/lib/types";

type PendingAnswer = Answer & { problems?: { title: string } | null };

/** Admin queue: posts the AI flagged (or couldn't check), with its reasoning. */
export default function ModerationQueuePage() {
  const { session, profile, loading } = useSession();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [answers, setAnswers] = useState<PendingAnswer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    const sb = supabase();
    const [p, a] = await Promise.all([
      sb.from("problems").select("*").eq("moderation_status", "pending").order("created_at", { ascending: false }),
      sb
        .from("answers")
        .select("*, problems(title), profiles(full_name, org_name, role)")
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    const firstError = p.error ?? a.error;
    if (firstError) setError(firstError.message);
    setProblems((p.data as Problem[]) ?? []);
    setAnswers((a.data as PendingAnswer[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function decide(table: "problems" | "answers", id: string, status: ModerationStatus) {
    setBusy(id);
    setError("");
    const { error } = await supabase().from(table).update({ moderation_status: status }).eq("id", id);
    setBusy(null);
    if (error) setError(error.message);
    load();
  }

  if (loading) return <p className="py-10 text-center text-mute">Loading…</p>;
  if (!session || !isAdmin) {
    return (
      <p className="py-10 text-center text-mute">
        Admins only.{" "}
        {!session && (
          <Link href="/login" className="font-semibold text-ink underline">
            Log in
          </Link>
        )}
      </p>
    );
  }

  const empty = loaded && problems.length === 0 && answers.length === 0;

  return (
    <div>
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="font-display text-3xl font-bold">Moderation queue</h1>
          <p className="text-sm text-canvas/70">
            Posts held for review — flagged by the AI check, or saved while it was unavailable. Approving publishes
            them; rejecting keeps them hidden (the author still sees the reason).
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {error && <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
        {!loaded && <p className="text-center text-mute">Loading queue…</p>}
        {empty && (
          <p className="border border-dashed border-mute p-8 text-center text-sm text-mute">Nothing waiting for review.</p>
        )}

        {problems.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Problems ({problems.length})</h2>
            <ul className="space-y-3">
              {problems.map((p) => (
                <QueueItem
                  key={p.id}
                  heading={p.title}
                  meta={`${p.category} · ${p.district} · by ${p.poster_name ?? "unknown"}`}
                  body={p.description}
                  reason={p.moderation_reason ?? null}
                  link={`/problems/${p.id}`}
                  busy={busy === p.id}
                  onApprove={() => decide("problems", p.id, "approved")}
                  onReject={() => decide("problems", p.id, "rejected")}
                />
              ))}
            </ul>
          </section>
        )}

        {answers.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg font-bold">Answers ({answers.length})</h2>
            <ul className="space-y-3">
              {answers.map((a) => (
                <QueueItem
                  key={a.id}
                  heading={`Answer on: ${a.problems?.title ?? "a problem"}`}
                  meta={`by ${a.profiles?.org_name || a.profiles?.full_name || "community member"}`}
                  body={a.body}
                  reason={a.moderation_reason}
                  link={`/problems/${a.problem_id}`}
                  busy={busy === a.id}
                  onApprove={() => decide("answers", a.id, "approved")}
                  onReject={() => decide("answers", a.id, "rejected")}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function QueueItem(props: {
  heading: string;
  meta: string;
  body: string;
  reason: string | null;
  link: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <li className="border border-ink bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={props.link} className="font-display font-bold hover:underline">
            {props.heading}
          </Link>
          <p className="text-xs uppercase text-mute">{props.meta}</p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={props.busy}
            onClick={props.onApprove}
            className="bg-ink px-3 py-1.5 font-display text-xs font-semibold uppercase text-canvas hover:bg-ink/80 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={props.busy}
            onClick={props.onReject}
            className="border border-ink px-3 py-1.5 font-display text-xs font-semibold uppercase hover:bg-ink hover:text-canvas disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">{props.body}</p>
      <p className="mt-2 border-l-2 border-ink pl-3 text-sm">
        <span className="font-display text-xs font-bold uppercase">AI reasoning: </span>
        <span className="italic">{props.reason ?? "No reason recorded."}</span>
      </p>
    </li>
  );
}
