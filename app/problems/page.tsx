"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Problem, PROBLEM_CATEGORIES, JHARKHAND_DISTRICTS } from "@/lib/types";
import { StatusBadge, UrgencyBadge } from "@/components/Badges";
import MapView, { MapMarker } from "@/components/MapView";

// monochrome marker scheme: open = ink, claimed = warm grey, resolved = pale
const STATUS_COLORS: Record<string, string> = {
  open: "#171512",
  claimed: "#857f74",
  resolved: "#cfc9bc",
};

const bandSelect =
  "border border-canvas/40 bg-ink px-2.5 py-1.5 text-sm text-canvas outline-none focus:border-canvas";

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
      textColor: p.status === "open" ? "#f4f1ea" : "#171512",
      popup: (
        <div className="text-sm">
          <strong>{p.title}</strong>
          <div>{p.district} · urgency {p.urgency}/5</div>
          <Link href={`/problems/${p.id}`} className="underline">
            Open →
          </Link>
        </div>
      ),
    }));

  return (
    <div>
      {/* Full-width black band: heading + filters */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold">Problem Board</h1>
              <p className="text-sm text-canvas/70">
                Real problems reported from the ground. University teams can claim and solve them.
              </p>
            </div>
            <Link
              href="/problems/new"
              className="bg-canvas px-4 py-2 font-display font-semibold text-ink hover:bg-canvas/80"
            >
              + Report a problem
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={bandSelect}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="claimed">Claimed</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} className={bandSelect}>
              <option value="all">All districts</option>
              {JHARKHAND_DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={bandSelect}>
              <option value="all">All categories</option>
              {PROBLEM_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="ml-auto flex border border-canvas/40 text-sm">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 font-display font-medium capitalize ${
                    view === v ? "bg-canvas text-ink" : "text-canvas hover:bg-canvas/10"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {view === "map" ? (
          <MapView markers={markers} height="520px" />
        ) : loading ? (
          <p className="py-10 text-center text-mute">Loading problems…</p>
        ) : filtered.length === 0 ? (
          <p className="border border-dashed border-mute py-10 text-center text-mute">
            No problems match these filters yet.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/problems/${p.id}`}
                className="block border border-ink bg-canvas p-4 transition hover:outline hover:outline-1 hover:outline-ink"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-semibold">{p.title}</h3>
                  <StatusBadge status={p.status} />
                  <UrgencyBadge urgency={p.urgency} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-mute">{p.description}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase text-mute">
                  <span>{p.district}{p.ward ? ` · ${p.ward}` : ""}</span>
                  <span>{p.category}</span>
                  <span>~{p.population_affected.toLocaleString()} affected</span>
                  {p.poster_name && <span>by {p.poster_name}</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
