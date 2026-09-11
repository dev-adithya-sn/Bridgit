"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Camp, Match, Need, Problem, Resource } from "@/lib/types";
import MapView, { MapMarker } from "@/components/MapView";

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="border border-ink bg-canvas p-4">
      <div className={`font-display text-3xl font-bold ${muted ? "text-mute" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase text-mute">{label}</div>
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

  // monochrome markers: camps = solid ink "C", open problems = off-white with ink number,
  // claimed problems = warm grey
  const markers: MapMarker[] = [
    ...camps.map((c) => ({
      id: `camp-${c.id}`,
      lat: c.lat,
      lng: c.lng,
      color: "#171512",
      label: "C",
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
        color: p.status === "open" ? "#f4f1ea" : "#857f74",
        label: String(p.urgency),
        textColor: "#171512",
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
      {/* Full-width black band */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="font-display text-3xl font-bold">Response Dashboard</h1>
          <p className="text-sm text-canvas/70">
            Live picture of the disaster response: problems, camps, supplies and matches.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <Stat label="Open problems" value={count(problems, "open")} />
          <Stat label="Claimed" value={count(problems, "claimed")} />
          <Stat label="Resolved" value={count(problems, "resolved")} muted />
          <Stat label="Relief camps" value={camps.length} />
          <Stat label="Open needs" value={count(needs, "open")} />
          <Stat label="Needs fulfilled" value={count(needs, "fulfilled")} muted />
          <Stat label="Supplies posted" value={resources.length} />
          <Stat
            label="Matches accepted"
            value={count(matches, "accepted") + count(matches, "delivered")}
          />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex flex-wrap gap-4 text-xs uppercase text-mute">
            <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-ink align-middle" />Relief camp</span>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-full border border-ink bg-canvas align-middle" />Open problem (number = urgency)</span>
            <span><span className="mr-1 inline-block h-3 w-3 rounded-full bg-mute align-middle" />Claimed problem</span>
          </div>
          <MapView markers={markers} height="520px" />
        </div>
      </div>
    </div>
  );
}
