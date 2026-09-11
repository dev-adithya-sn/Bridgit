"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Problem, PROBLEM_CATEGORIES, JHARKHAND_DISTRICTS } from "@/lib/types";
import { StatusBadge, UrgencyBadge } from "@/components/Badges";
import MapView, { MapMarker } from "@/components/MapView";

const STATUS_COLORS: Record<string, string> = {
  open: "#dc2626",
  claimed: "#d97706",
  resolved: "#64748b",
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [district, setDistrict] = useState("all");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "map">("list");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase()
      .from("problems")
      .select("*")
      .order("urgency", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProblems((data as Problem[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(
    () =>
      problems.filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (district === "all" || p.district === district) &&
          (category === "all" || p.category === category)
      ),
    [problems, status, district, category]
  );

  const markers: MapMarker[] = filtered
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      color: STATUS_COLORS[p.status],
      label: String(p.urgency),
      popup: (
        <div className="text-sm">
          <strong>{p.title}</strong>
          <div>{p.district} · urgency {p.urgency}/5</div>
          <Link href={`/problems/${p.id}`} className="text-blue-700 underline">
            Open →
          </Link>
        </div>
      ),
    }));

  const select =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Problem Board</h1>
          <p className="text-sm text-slate-600">
            Real problems reported from the ground. University teams can claim and solve them.
          </p>
        </div>
        <Link
          href="/problems/new"
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
        >
          + Report a problem
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="claimed">Claimed</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className={select}>
          <option value="all">All districts</option>
          {JHARKHAND_DISTRICTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={select}>
          <option value="all">All categories</option>
          {PROBLEM_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <div className="ml-auto flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium capitalize ${
                view === v ? "bg-blue-700 text-white" : "text-slate-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <MapView markers={markers} height="520px" />
      ) : loading ? (
        <p className="py-10 text-center text-slate-500">Loading problems…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-500">
          No problems match these filters yet.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/problems/${p.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{p.title}</h3>
                <StatusBadge status={p.status} />
                <UrgencyBadge urgency={p.urgency} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>📍 {p.district}{p.ward ? ` · ${p.ward}` : ""}</span>
                <span>🏷 {p.category}</span>
                <span>👥 ~{p.population_affected.toLocaleString()} affected</span>
                {p.poster_name && <span>✍️ {p.poster_name}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
