"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { PROBLEM_CATEGORIES, JHARKHAND_DISTRICTS, URGENCY_LABELS } from "@/lib/types";
import LocationPicker from "@/components/LocationPicker";
import Link from "next/link";

export default function NewProblemPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(PROBLEM_CATEGORIES[0]);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase().from("problems").insert({
      title,
      description,
      category,
      district,
      ward: ward || null,
      lat,
      lng,
      urgency,
      population_affected: population,
      posted_by: session!.user.id,
      poster_name: profile?.full_name || session!.user.email,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/problems");
  }

  const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

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
            {busy ? "Posting…" : "Post problem"}
          </button>
        </form>
      </div>
    </div>
  );
}
