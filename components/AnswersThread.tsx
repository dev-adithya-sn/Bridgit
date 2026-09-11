"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { postWithSession } from "@/lib/authFetch";
import { useSession } from "@/lib/useSession";
import type { Answer, PostOutcome } from "@/lib/types";
import { ModerationBadge } from "./Badges";

/**
 * Open community answers on a problem. Anyone signed in can answer; each
 * answer is moderated before it's published. Separate from the university
 * teams' claim → solution flow.
 */
export default function AnswersThread({ problemId }: { problemId: string }) {
  const { session } = useSession();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; title: string; body?: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("answers")
      .select("*, profiles(full_name, org_name, role)")
      .eq("problem_id", problemId)
      .order("created_at", { ascending: true });
    if (error) {
      setUnavailable(true); // table not created yet (migration 002)
      return;
    }
    setAnswers((data as Answer[]) ?? []);
  }, [problemId]);

  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, [load, session?.user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const { status, json } = await postWithSession("/api/answers", { problemId, body: text });
    setBusy(false);
    const outcome = json as PostOutcome;
    if (outcome?.verdict === "approved") {
      setText("");
      setNotice({ tone: "info", title: "Answer posted." });
    } else if (outcome?.verdict === "flagged") {
      setText("");
      setNotice({
        tone: "info",
        title: "Submitted — under review",
        body: `A moderator will check it before it's public. ${outcome.reasoning}`,
      });
    } else if (outcome?.verdict === "rejected") {
      setNotice({
        tone: "error",
        title: "Not posted — this looked like spam",
        body: `Edit your answer to add genuine detail and try again. ${outcome.reasoning}`,
      });
    } else {
      setNotice({ tone: "error", title: json?.error ?? `Could not post (HTTP ${status}).` });
    }
    load();
  }

  if (unavailable) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">
        Community answers {answers.length > 0 && <span className="text-mute">({answers.length})</span>}
      </h2>
      <p className="text-sm text-mute">
        Ideas, questions and local knowledge from anyone. University teams still claim and solve problems above.
      </p>

      <ol className="mt-4 space-y-3">
        {answers.length === 0 && (
          <li className="border border-dashed border-mute p-4 text-center text-sm text-mute">No answers yet.</li>
        )}
        {answers.map((a) => (
          <li key={a.id} className="border border-ink bg-canvas p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
              <span className="font-semibold uppercase text-ink">
                {a.profiles?.org_name || a.profiles?.full_name || "Community member"}
              </span>
              <span>{new Date(a.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              <ModerationBadge status={a.moderation_status} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
          </li>
        ))}
      </ol>

      {session ? (
        <form onSubmit={submit} className="mt-4 space-y-2 border border-ink bg-canvas p-4">
          <label className="block font-display text-sm font-semibold">Add an answer</label>
          <textarea
            required
            rows={3}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share what you know: who to contact, what worked nearby, or a question that helps."
            className="w-full border border-ink bg-white px-3 py-2 text-sm outline-none"
          />
          {notice && (
            <div className={`p-3 text-sm ${notice.tone === "error" ? "bg-ink text-canvas" : "border border-ink"}`}>
              <p className="font-semibold">{notice.title}</p>
              {notice.body && <p className="mt-1">{notice.body}</p>}
            </div>
          )}
          <button
            disabled={busy || !text.trim()}
            className="bg-ink px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
          >
            {busy ? "Checking & posting…" : "Post answer"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-mute">
          <Link href="/login" className="font-semibold text-ink underline">
            Log in
          </Link>{" "}
          to add an answer.
        </p>
      )}
    </section>
  );
}
