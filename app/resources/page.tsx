"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import {
  Camp, Need, Resource, RESOURCE_TYPES, JHARKHAND_DISTRICTS, URGENCY_LABELS,
} from "@/lib/types";
import { suggestMatches } from "@/lib/matching";
import { StatusBadge, UrgencyBadge } from "@/components/Badges";
import LocationPicker from "@/components/LocationPicker";

const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

export default function ResourcesPage() {
  const router = useRouter();
  const { session, profile, loading } = useSession();
  const [resources, setResources] = useState<Resource[]>([]);
  const [needs, setNeeds] = useState<(Need & { camps: Camp })[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [form, setForm] = useState<"none" | "resource" | "need">("none");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // independent type filters for the two lists
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [needTypeFilter, setNeedTypeFilter] = useState("all");

  // resource form state
  const [rType, setRType] = useState("water");
  const [rQty, setRQty] = useState(1000);
  const [rUnit, setRUnit] = useState("bottles (1L)");
  const [rDistrict, setRDistrict] = useState("Ranchi");
  const [rLat, setRLat] = useState<number | null>(null);
  const [rLng, setRLng] = useState<number | null>(null);

  // need form state
  const [nCamp, setNCamp] = useState("");
  const [nType, setNType] = useState("water");
  const [nQty, setNQty] = useState(500);
  const [nUnit, setNUnit] = useState("bottles (1L)");
  const [nUrgency, setNUrgency] = useState(3);

  const load = useCallback(async () => {
    const sb = supabase();
    const [r, n, c] = await Promise.all([
      sb.from("resources").select("*").order("created_at", { ascending: false }),
      sb.from("needs").select("*, camps(*)").order("urgency", { ascending: false }),
      sb.from("camps").select("*").order("name"),
    ]);
    setResources((r.data as Resource[]) ?? []);
    setNeeds((n.data as (Need & { camps: Camp })[]) ?? []);
    setCamps((c.data as Camp[]) ?? []);
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) load();
  }, [load]);

  /** Post a resource, run the matching engine, and jump to the suggestions. */
  async function postResource(e: React.FormEvent) {
    e.preventDefault();
    if (rLat == null || rLng == null) {
      setError("Please click the map to mark where the supplies are.");
      return;
    }
    setBusy(true);
    setError("");
    const sb = supabase();
    const { data: inserted, error: insErr } = await sb
      .from("resources")
      .insert({
        type: rType,
        quantity: rQty,
        quantity_remaining: rQty,
        unit: rUnit,
        district: rDistrict,
        lat: rLat,
        lng: rLng,
        posted_by: session!.user.id,
        donor_name: profile?.org_name || profile?.full_name || session!.user.email,
      })
      .select()
      .single();
    if (insErr || !inserted) {
      setBusy(false);
      setError(insErr?.message ?? "Could not post resource.");
      return;
    }

    // ── The matching engine runs here ──
    const { data: openNeeds } = await sb
      .from("needs")
      .select("*, camps(*)")
      .eq("type", rType)
      .eq("status", "open");
    const suggestions = suggestMatches(
      (openNeeds as (Need & { camps: Camp })[]) ?? [], rLat, rLng, rQty
    );
    if (suggestions.length > 0) {
      await sb.from("matches").insert(
        suggestions.map((s) => ({
          resource_id: inserted.id,
          need_id: s.need.id,
          quantity_allocated: s.quantityAllocated,
          score: s.breakdown.finalScore,
          score_breakdown: s.breakdown,
        }))
      );
    }
    setBusy(false);
    router.push(`/matches?resource=${inserted.id}`);
  }

  async function postNeed(e: React.FormEvent) {
    e.preventDefault();
    if (!nCamp) {
      setError("Please choose a camp.");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await supabase().from("needs").insert({
      camp_id: nCamp,
      type: nType,
      quantity_needed: nQty,
      unit: nUnit,
      urgency: nUrgency,
      posted_by: session!.user.id,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm("none");
    load();
  }

  const typeLabel = (v: string) =>
    RESOURCE_TYPES.find((t) => t.value === v)?.label ?? v;

  const visibleResources = useMemo(
    () => resources.filter((r) => resourceTypeFilter === "all" || r.type === resourceTypeFilter),
    [resources, resourceTypeFilter]
  );
  const visibleNeeds = useMemo(
    () => needs.filter((n) => needTypeFilter === "all" || n.type === needTypeFilter),
    [needs, needTypeFilter]
  );

  const filterSelect =
    "border border-ink bg-canvas px-2.5 py-1.5 text-sm outline-none";

  return (
    <div>
      {/* Full-width black band: heading + post actions */}
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <h1 className="font-display text-3xl font-bold">Resources &amp; Needs</h1>
            <p className="text-sm text-canvas/70">
              Supply on the left, demand on the right. Posting a resource instantly
              runs the smart matcher.
            </p>
          </div>
          {session ? (
            <div className="flex gap-2">
              <button
                onClick={() => setForm(form === "resource" ? "none" : "resource")}
                className="bg-canvas px-4 py-2 font-display font-semibold text-ink hover:bg-canvas/80"
              >
                + I have supplies
              </button>
              <button
                onClick={() => setForm(form === "need" ? "none" : "need")}
                className="border border-canvas px-4 py-2 font-display font-semibold text-canvas hover:bg-canvas hover:text-ink"
              >
                + My camp needs
              </button>
            </div>
          ) : (
            !loading && (
              <Link href="/login" className="font-semibold text-canvas underline">
                Log in to post
              </Link>
            )
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
      {error && <p className="mb-3 bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}

      {form === "resource" && session && (
        <form onSubmit={postResource} className="mb-6 border border-ink bg-canvas p-5">
          <h2 className="mb-3 font-display font-bold">Post available supplies</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Type</span>
              <select value={rType} onChange={(e) => setRType(e.target.value)} className={input}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">District</span>
              <select value={rDistrict} onChange={(e) => setRDistrict(e.target.value)} className={input}>
                {JHARKHAND_DISTRICTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Quantity</span>
              <input type="number" min={1} value={rQty}
                onChange={(e) => setRQty(Number(e.target.value))} className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Unit</span>
              <input value={rUnit} onChange={(e) => setRUnit(e.target.value)}
                placeholder="bottles / packets / kits" className={input} />
            </label>
          </div>
          <div className="mt-4">
            <span className="mb-1 block text-sm font-medium">Where are the supplies now?</span>
            <LocationPicker lat={rLat} lng={rLng} onPick={(a, b) => { setRLat(a); setRLng(b); }} />
          </div>
          <button disabled={busy}
            className="mt-4 bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50">
            {busy ? "Matching…" : "Post & find best matches →"}
          </button>
        </form>
      )}

      {form === "need" && session && (
        <form onSubmit={postNeed} className="mb-6 border border-ink bg-canvas p-5">
          <h2 className="mb-3 font-display font-bold">Post a camp need</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">Camp</span>
              <select value={nCamp} onChange={(e) => setNCamp(e.target.value)} className={input}>
                <option value="">— choose a camp —</option>
                {camps.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.district}, pop. {c.population})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Type</span>
              <select value={nType} onChange={(e) => setNType(e.target.value)} className={input}>
                {RESOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Quantity needed</span>
              <input type="number" min={1} value={nQty}
                onChange={(e) => setNQty(Number(e.target.value))} className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Unit</span>
              <input value={nUnit} onChange={(e) => setNUnit(e.target.value)} className={input} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">
                Urgency: <strong>{URGENCY_LABELS[nUrgency]} ({nUrgency}/5)</strong>
              </span>
              <input type="range" min={1} max={5} value={nUrgency}
                onChange={(e) => setNUrgency(Number(e.target.value))} className="w-full accent-ink" />
            </label>
          </div>
          <button disabled={busy}
            className="mt-4 bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50">
            {busy ? "Posting…" : "Post need"}
          </button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display font-bold">Available supplies</h2>
            <select
              value={resourceTypeFilter}
              onChange={(e) => setResourceTypeFilter(e.target.value)}
              className={filterSelect}
            >
              <option value="all">All types</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {visibleResources.length === 0 && (
              <p className="text-sm text-mute">
                {resources.length === 0
                  ? "No supplies posted yet."
                  : `No ${typeLabel(resourceTypeFilter).toLowerCase()} supplies posted.`}
              </p>
            )}
            {visibleResources.map((r) => (
              <div key={r.id} className="border border-ink bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize">{typeLabel(r.type)}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-sm text-mute">
                  {r.quantity_remaining.toLocaleString()} of {r.quantity.toLocaleString()} {r.unit} remaining
                  {r.district ? ` · from ${r.district}` : ""}
                  {r.donor_name ? ` · by ${r.donor_name}` : ""}
                </p>
                <Link href={`/matches?resource=${r.id}`}
                  className="mt-1 inline-block text-sm font-semibold text-ink underline underline-offset-2 hover:text-mute">
                  View matches →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display font-bold">Camp needs</h2>
            <select
              value={needTypeFilter}
              onChange={(e) => setNeedTypeFilter(e.target.value)}
              className={filterSelect}
            >
              <option value="all">All types</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {visibleNeeds.length === 0 && (
              <p className="text-sm text-mute">
                {needs.length === 0
                  ? "No needs posted yet."
                  : `No ${typeLabel(needTypeFilter).toLowerCase()} needs posted.`}
              </p>
            )}
            {visibleNeeds.map((n) => (
              <div key={n.id} className="border border-ink bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold capitalize">{typeLabel(n.type)}</span>
                  <UrgencyBadge urgency={n.urgency} />
                  <StatusBadge status={n.status} />
                </div>
                <p className="mt-1 text-sm text-mute">
                  {n.camps?.name} ({n.camps?.district}) · needs{" "}
                  {(n.quantity_needed - n.quantity_received).toLocaleString()} {n.unit}
                  {n.quantity_received > 0 &&
                    ` (${n.quantity_received.toLocaleString()} received)`}{" "}
                  · pop. {n.camps?.population.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
