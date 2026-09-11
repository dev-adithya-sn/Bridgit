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
      <p className="py-10 text-center text-slate-600">
        Please{" "}
        <Link href="/login" className="font-semibold text-blue-700 underline">
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

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Report a problem</h1>
      <p className="mt-1 text-sm text-slate-600">
        Describe what&apos;s happening on the ground so responders and university
        teams can act on it.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
            className="w-full"
          />
        </label>
        <div>
          <span className="mb-1 block text-sm font-medium">Location</span>
          <LocationPicker lat={lat} lng={lng} onPick={(a, b) => { setLat(a); setLng(b); }} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Posting…" : "Post problem"}
        </button>
      </form>
    </div>
  );
}
