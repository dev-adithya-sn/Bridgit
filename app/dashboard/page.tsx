"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Camp, Match, Need, Problem, Resource } from "@/lib/types";
import MapView, { MapMarker } from "@/components/MapView";

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [needs, setNeeds] = useState<(Need & { camps: Camp })[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = supabase();
    Promise.all([
      sb.from("problems").select("*"),
      sb.from("needs").select("*, camps(*)"),
      sb.from("camps").select("*"),
      sb.from("matches").select("*"),
      sb.from("resources").select("*"),
    ]).then(([p, n, c, m, r]) => {
      setProblems((p.data as Problem[]) ?? []);
      setNeeds((n.data as (Need & { camps: Camp })[]) ?? []);
      setCamps((c.data as Camp[]) ?? []);
      setMatches((m.data as Match[]) ?? []);
      setResources((r.data as Resource[]) ?? []);
    });
  }, []);

  const count = (arr: { status: string }[], s: string) =>
    arr.filter((x) => x.status === s).length;

  const markers: MapMarker[] = [
    ...camps.map((c) => ({
      id: `camp-${c.id}`,
      lat: c.lat,
      lng: c.lng,
      color: "#1d4ed8",
      label: "⛺",
      popup: (
        <div className="text-sm">
          <strong>{c.name}</strong>
          <div>{c.district} · pop. {c.population.toLocaleString()}</div>
          <div>
            {needs.filter((n) => n.camp_id === c.id && n.status === "open").length} open needs
          </div>
        </div>
      ),
    })),
    ...problems
      .filter((p) => p.lat != null && p.lng != null && p.status !== "resolved")
      .map((p) => ({
        id: `prob-${p.id}`,
        lat: p.lat!,
        lng: p.lng!,
        color: p.status === "open" ? "#dc2626" : "#d97706",
        label: String(p.urgency),
        popup: (
          <div className="text-sm">
            <strong>{p.title}</strong>
            <div>{p.district} · {p.status}</div>
          </div>
        ),
      })),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Response Dashboard</h1>
      <p className="mb-4 text-sm text-slate-600">
        Live picture of the disaster response: problems, camps, supplies and matches.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Open problems" value={count(problems, "open")} accent="text-rose-600" />
        <Stat label="Claimed" value={count(problems, "claimed")} accent="text-amber-600" />
        <Stat label="Resolved" value={count(problems, "resolved")} accent="text-emerald-600" />
        <Stat label="Relief camps" value={camps.length} accent="text-blue-700" />
        <Stat label="Open needs" value={count(needs, "open")} accent="text-rose-600" />
        <Stat label="Needs fulfilled" value={count(needs, "fulfilled")} accent="text-emerald-600" />
        <Stat label="Supplies posted" value={resources.length} accent="text-blue-700" />
        <Stat
          label="Matches accepted"
          value={count(matches, "accepted") + count(matches, "delivered")}
          accent="text-emerald-600"
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-600">
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-blue-700 align-middle" />Relief camp</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-red-600 align-middle" />Open problem (number = urgency)</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-amber-600 align-middle" />Claimed problem</span>
        </div>
        <MapView markers={markers} height="520px" />
      </div>
    </div>
  );
}
