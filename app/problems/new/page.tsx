"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postWithSession } from "@/lib/authFetch";
import { useSession } from "@/lib/useSession";
import { useIntegrationStatus } from "@/lib/useIntegrationStatus";
import { PROBLEM_CATEGORIES, PROBLEM_DOMAINS, JHARKHAND_DISTRICTS, URGENCY_LABELS, PostOutcome } from "@/lib/types";
import LocationPicker from "@/components/LocationPicker";
import IntegrationNotice from "@/components/IntegrationNotice";
import Link from "next/link";

export default function NewProblemPage() {
  const router = useRouter();
  const { session, loading } = useSession();
  const integrations = useIntegrationStatus();
  const [outcome, setOutcome] = useState<PostOutcome | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(PROBLEM_CATEGORIES[0]);
  const [domain, setDomain] = useState<string>("");
  const [domainReasoning, setDomainReasoning] = useState<string>("");
  const [domainMethod, setDomainMethod] = useState<string>("");
  const [classifying, setClassifying] = useState(false);
  const [district, setDistrict] = useState<string>("Ranchi");
  const [ward, setWard] = useState("");
  const [urgency, setUrgency] = useState(3);
  const [population, setPopulation] = useState(100);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && !session) {
    return (
      <p className="py-10 text-center text-mute">
        Please{" "}
        <Link href="/login" className="font-semibold text-ink underline">
          log in
        </Link>{" "}
        to report a problem.
      </p>
    );
  }

  async function suggestDomain() {
    setClassifying(true);
    setError("");
    const { status: httpStatus, json } = await postWithSession("/api/classify-domain", { title, description });
    setClassifying(false);
    if (httpStatus !== 200) {
      setError(json?.error ?? "Could not suggest a domain — pick one manually below.");
      return;
    }
    if (json.domain) {
      setDomain(json.domain);
      setDomainReasoning(json.reasoning ?? "");
      setDomainMethod(json.method ?? "");
    } else {
      setDomainReasoning(json.reasoning ?? "Couldn't tell — pick one manually.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOutcome(null);
    const { status, json } = await postWithSession("/api/problems", {
      title,
      description,
      category,
      district,
      ward: ward || null,
      lat,
      lng,
      urgency,
      population_affected: population,
      // the domain column only exists once migration 003 is applied
      ...(integrations?.domainRouting && domain ? { domain } : {}),
    });
    setBusy(false);
    if (json?.verdict) {
      const result = json as PostOutcome;
      if (result.verdict === "approved") {
        router.push("/problems");
        return;
      }
      // rejected: keep the form filled in so it can be edited and resubmitted
      setOutcome(result);
      return;
    }
    setError(json?.error ?? `Could not post the problem (HTTP ${status}).`);
  }

  const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

  if (outcome?.verdict === "flagged") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="border border-ink bg-canvas p-6">
          <h1 className="font-display text-2xl font-bold">Submitted — under review</h1>
          <p className="mt-2 text-sm">
            Your problem was saved, but our automatic check held it for a moderator before it appears on the public
            board. You can still see it on the board yourself, marked &ldquo;Under review&rdquo;.
          </p>
          <p className="mt-3 border-l border-ink pl-3 text-sm italic text-mute">&ldquo;{outcome.reasoning}&rdquo;</p>
          <div className="mt-5 flex gap-2">
            <Link
              href="/problems"
              className="bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80"
            >
              Go to the board
            </Link>
            {outcome.id && (
              <Link
                href={`/problems/${outcome.id}`}
                className="border border-ink px-4 py-2 font-display font-semibold uppercase tracking-wide hover:bg-ink hover:text-canvas"
              >
                View your post
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Black header band */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="font-display text-3xl font-bold">Report a problem</h1>
          <p className="mt-1 text-sm text-canvas/70">
            Describe what&apos;s happening on the ground so responders and university
            teams can act on it.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <IntegrationNotice status={integrations} scope="posting" />
        <IntegrationNotice status={integrations} scope="routing" />
        {outcome?.verdict === "rejected" && (
          <div className="mb-4 border-2 border-ink bg-canvas p-4 text-sm">
            <p className="font-display font-bold">Not posted — this looked like spam</p>
            <p className="mt-1">
              Our automatic check didn&apos;t find a genuine community issue in this post. If it is one, add more
              detail about what&apos;s wrong, where, and who is affected, then submit again.
            </p>
            <p className="mt-2 border-l border-ink pl-3 italic text-mute">&ldquo;{outcome.reasoning}&rdquo;</p>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4 border border-ink bg-canvas p-6">
          <input
            required
            placeholder='Short title, e.g. "Ward 4 needs a medical camp"'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
          <textarea
            required
            rows={4}
            placeholder="What exactly is the problem? Who is affected? What help is needed?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={input}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {PROBLEM_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">District</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} className={input}>
                {JHARKHAND_DISTRICTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Ward / area (optional)</span>
              <input value={ward} onChange={(e) => setWard(e.target.value)} className={input} />
            </label>
            {integrations?.domainRouting && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 flex flex-wrap items-center justify-between gap-2 font-medium">
                  <span>
                    Domain{" "}
                    <span className="font-normal text-mute">
                      — which university teams/institutions this could be routed to
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={suggestDomain}
                    disabled={classifying || (title.length < 3 && description.length < 10)}
                    className="border border-ink px-2.5 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-ink hover:text-canvas disabled:opacity-40"
                  >
                    {classifying ? "Suggesting…" : "Suggest domain"}
                  </button>
                </span>
                <select value={domain} onChange={(e) => setDomain(e.target.value)} className={input}>
                  <option value="">— choose a domain —</option>
                  {PROBLEM_DOMAINS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                {domainReasoning && (
                  <span className="mt-1 block text-xs text-mute">
                    {domainMethod === "llm" ? "AI suggestion" : domainMethod === "keyword" ? "Keyword-matched suggestion" : "Note"}: {domainReasoning}{" "}
                    {domain && "— you can change it above."}
                  </span>
                )}
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">People affected (approx.)</span>
              <input
                type="number"
                min={1}
                value={population}
                onChange={(e) => setPopulation(Number(e.target.value))}
                className={input}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Urgency: <strong>{URGENCY_LABELS[urgency]} ({urgency}/5)</strong>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
              className="w-full accent-ink"
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium">Location</span>
            <LocationPicker lat={lat} lng={lng} onPick={(a, b) => { setLat(a); setLng(b); }} />
          </div>
          {error && <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
          <button
            disabled={busy}
            className="w-full bg-ink py-2.5 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
          >
            {busy ? "Checking & posting…" : outcome?.verdict === "rejected" ? "Resubmit" : "Post problem"}
          </button>
        </form>
      </div>
    </div>
  );
}
