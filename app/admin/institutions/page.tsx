"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import type { InstitutionRepresentative } from "@/lib/types";

/**
 * Admin-only: approve institution representatives. Without this screen,
 * nothing built for domain routing is reachable — every institution's rep
 * row starts unverified (supabase/migrations/004), and only an admin update
 * can flip that, which is exactly what "Verify" below does.
 */
export default function InstitutionVerificationPage() {
  const { session, profile, loading } = useSession();
  const [pending, setPending] = useState<InstitutionRepresentative[]>([]);
  const [verified, setVerified] = useState<InstitutionRepresentative[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    const sb = supabase();
    const [p, v] = await Promise.all([
      sb
        .from("institution_representatives")
        .select("*, institutions(*), profiles(full_name, org_name, role)")
        .eq("verified", false)
        .order("created_at", { ascending: false }),
      sb
        .from("institution_representatives")
        .select("*, institutions(*), profiles(full_name, org_name, role)")
        .eq("verified", true)
        .order("created_at", { ascending: false }),
    ]);
    const firstError = p.error ?? v.error;
    if (firstError) setError(firstError.message);
    setPending((p.data as InstitutionRepresentative[]) ?? []);
    setVerified((v.data as InstitutionRepresentative[]) ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function setVerifiedStatus(id: string, next: boolean) {
    setBusy(id);
    setError("");
    const { error } = await supabase().from("institution_representatives").update({ verified: next }).eq("id", id);
    setBusy(null);
    if (error) setError(error.message);
    load();
  }

  if (loading) return <p className="py-10 text-center text-mute">Loading…</p>;
  if (!session || !isAdmin) {
    return (
      <p className="py-10 text-center text-mute">
        Admins only.{" "}
        {!session && (
          <Link href="/login" className="font-semibold text-ink underline">
            Log in
          </Link>
        )}
      </p>
    );
  }

  return (
    <div>
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="font-display text-3xl font-bold">Institution representatives</h1>
          <p className="text-sm text-canvas/70">
            Verifying someone here is what lets them accept or decline routing suggestions on their institution&apos;s
            behalf — nobody can do that until an admin confirms them.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {error && <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
        {!loaded && <p className="text-center text-mute">Loading…</p>}

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Pending verification ({pending.length})</h2>
          {loaded && pending.length === 0 && (
            <p className="border border-dashed border-mute p-6 text-center text-sm text-mute">Nothing waiting.</p>
          )}
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink bg-canvas p-4">
                <div className="min-w-0">
                  <Link href={`/routing?institution=${r.institution_id}`} className="font-display font-bold hover:underline">
                    {r.institutions?.name ?? "Unknown institution"}
                  </Link>
                  <p className="text-xs uppercase text-mute">
                    {r.profiles?.full_name ?? "Unknown"} · {r.profiles?.org_name ?? ""}
                  </p>
                </div>
                <button
                  disabled={busy === r.id}
                  onClick={() => setVerifiedStatus(r.id, true)}
                  className="bg-ink px-3 py-1.5 font-display text-xs font-semibold uppercase text-canvas hover:bg-ink/80 disabled:opacity-50"
                >
                  Verify
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Verified representatives ({verified.length})</h2>
          {loaded && verified.length === 0 && <p className="text-sm text-mute">None yet.</p>}
          <ul className="space-y-2">
            {verified.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border border-ink bg-canvas p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold">{r.institutions?.name ?? "Unknown institution"}</span>{" "}
                  <span className="text-mute">— {r.profiles?.full_name ?? "Unknown"}</span>
                </div>
                <button
                  disabled={busy === r.id}
                  onClick={() => setVerifiedStatus(r.id, false)}
                  className="border border-ink px-3 py-1 text-xs font-semibold uppercase hover:bg-ink hover:text-canvas disabled:opacity-50"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
