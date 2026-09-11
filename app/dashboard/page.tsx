"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Camp, IndustryPartner, Institution, Match, Need, PROBLEM_DOMAINS, Problem, Resource } from "@/lib/types";
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
  const { profile } = useSession();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [needs, setNeeds] = useState<(Need & { camps: Camp })[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [industryPartners, setIndustryPartners] = useState<IndustryPartner[]>([]);
  const [engagedInstitutionIds, setEngagedInstitutionIds] = useState<Set<string>>(new Set());
  const [verifiedInstitutionIds, setVerifiedInstitutionIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = supabase();
    Promise.all([
      sb.from("problems").select("*"),
      sb.from("needs").select("*, camps(*)"),
      sb.from("camps").select("*"),
      sb.from("matches").select("*"),
      sb.from("resources").select("*"),
      // supabase/migrations/003 — absent before it's applied, handled below
      sb.from("institutions").select("*"),
      sb.from("industry_partners").select("*"),
      sb.from("problem_routing").select("institution_id, status"),
    ]).then(([p, n, c, m, r, inst, ind, routing]) => {
      setProblems((p.data as Problem[]) ?? []);
      setNeeds((n.data as (Need & { camps: Camp })[]) ?? []);
      setCamps((c.data as Camp[]) ?? []);
      setMatches((m.data as Match[]) ?? []);
      setResources((r.data as Resource[]) ?? []);
      setInstitutions((inst.data as Institution[]) ?? []);
      setIndustryPartners((ind.data as IndustryPartner[]) ?? []);
      const engaged = new Set(
        ((routing.data as { institution_id: string; status: string }[]) ?? [])
          .filter((x) => x.status === "accepted")
          .map((x) => x.institution_id)
      );
      setEngagedInstitutionIds(engaged);
    });
  }, []);

  // Admin-only: institution_representatives is self-or-admin read (migration
  // 004), so a true "verified institutions" count only exists for admins —
  // everyone else sees the publicly-computable "engaged" count above instead.
  useEffect(() => {
    if (!isSupabaseConfigured || profile?.role !== "admin") return;
    supabase()
      .from("institution_representatives")
      .select("institution_id")
      .eq("verified", true)
      .then(({ data }) => {
        setVerifiedInstitutionIds(new Set(((data as { institution_id: string }[]) ?? []).map((x) => x.institution_id)));
      });
  }, [profile?.role]);

  const domainCounts = PROBLEM_DOMAINS.map((d) => ({
    domain: d,
    count: problems.filter((p) => p.domain === d).length,
  })).filter((d) => d.count > 0);

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

        {domainCounts.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 font-display text-lg font-bold">Problems by domain</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {domainCounts.map((d) => (
                <Stat key={d.domain} label={d.domain} value={d.count} />
              ))}
            </div>
          </div>
        )}

        {(institutions.length > 0 || industryPartners.length > 0) && (
          <div className="mt-6">
            <h2 className="mb-2 font-display text-lg font-bold">Institutional & industry participation</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Institutions registered" value={institutions.length} />
              {profile?.role === "admin" && verifiedInstitutionIds ? (
                <Stat label="Verified institutions" value={verifiedInstitutionIds.size} />
              ) : (
                <Stat label="Institutions engaged" value={engagedInstitutionIds.size} muted />
              )}
              {/* No engagement metric here: nothing in this build links industry
                  partners to problem_routing, so a total is the honest number
                  we can show — see the Part 3 summary for why. */}
              <Stat label="Industry partners" value={industryPartners.length} />
            </div>
          </div>
        )}

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
