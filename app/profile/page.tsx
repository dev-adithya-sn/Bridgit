"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { normalizePhone } from "@/lib/phone";
import { MAX_CAPABILITY_CHARS } from "@/lib/capabilityLimits";
import { useIntegrationStatus } from "@/lib/useIntegrationStatus";
import IntegrationNotice from "@/components/IntegrationNotice";
import type { IndustryPartner, Institution } from "@/lib/types";

const ROLE_LABELS: Record<string, string> = {
  citizen: "Citizen",
  ngo: "NGO / Donor",
  camp: "Relief Camp",
  university_team: "University Team",
  institution: "Academic Institution",
  industry_partner: "Industry Partner",
  admin: "Admin",
};

/** Shown for role = institution / industry_partner instead of the donor form below. */
function OrgStatusPanel({ userId, role }: { userId: string; role: string }) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [partner, setPartner] = useState<IndustryPartner | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (role === "institution") {
      sb.from("institutions")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(async ({ data }) => {
          setInstitution(data as Institution | null);
          if (data) {
            // Self-read only (supabase/migrations/004) — this is exactly the row an
            // admin flips in app/admin/institutions to grant accept/decline rights.
            const { data: rep } = await sb
              .from("institution_representatives")
              .select("verified")
              .eq("institution_id", data.id)
              .eq("profile_id", userId)
              .maybeSingle();
            setVerified(rep?.verified ?? false);
          }
          setLoaded(true);
        });
    } else {
      sb.from("industry_partners")
        .select("*")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setPartner(data as IndustryPartner | null);
          setLoaded(true);
        });
    }
  }, [userId, role]);

  if (!loaded) return <p className="py-10 text-center text-mute">Loading…</p>;

  const org = institution ?? partner;
  if (!org) {
    return (
      <p className="border border-dashed border-mute p-6 text-center text-sm text-mute">
        No {role === "institution" ? "institution" : "industry partner"} registration found on this account.
      </p>
    );
  }

  return (
    <div className="space-y-4 border border-ink bg-canvas p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-mute">Registered as</p>
        <p className="font-display text-xl font-bold">{org.name}</p>
      </div>
      {institution && (
        <p
          className={`inline-block border px-3 py-1 text-sm font-semibold uppercase tracking-wide ${
            verified ? "border-ink bg-ink text-canvas" : "border-dashed border-ink text-ink"
          }`}
        >
          {verified ? "Verified representative" : "Pending verification"}
        </p>
      )}
      {institution && !verified && (
        <p className="text-sm text-mute">
          An admin needs to confirm you before you can accept routing suggestions on {org.name}&apos;s behalf. Nothing
          else is blocked in the meantime — the institution is already listed and can receive suggestions.
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-2">
        {institution?.district && (
          <div>
            <dt className="text-xs text-mute">District</dt>
            <dd>{institution.district}</dd>
          </div>
        )}
        {partner?.sector && (
          <div>
            <dt className="text-xs text-mute">Sector</dt>
            <dd>{partner.sector}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs text-mute">Domains</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {org.domains.map((d) => (
              <span key={d} className="border border-ink px-2 py-0.5 text-xs uppercase">
                {d}
              </span>
            ))}
          </dd>
        </div>
      </dl>
      {(institution?.description || partner?.capabilities) && (
        <p className="whitespace-pre-wrap border-t border-ink pt-3 text-sm">
          {institution?.description || partner?.capabilities}
        </p>
      )}
      {institution && (
        <Link href="/routing" className="inline-block text-sm font-semibold text-ink underline underline-offset-2">
          View routing suggestions →
        </Link>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { session, profile, loading } = useSession();
  const integrations = useIntegrationStatus();
  const [capability, setCapability] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setCapability(profile.capability_description ?? "");
    setPhone(profile.phone_number ?? "");
  }, [profile]);

  if (loading) return <p className="py-10 text-center text-mute">Loading…</p>;
  if (!session) {
    return (
      <p className="py-10 text-center text-mute">
        Please{" "}
        <Link href="/login" className="font-semibold text-ink underline">
          log in
        </Link>{" "}
        to edit your profile.
      </p>
    );
  }

  const isDonor = profile?.role === "ngo" || profile?.role === "camp";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const normalizedPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      setError("Enter the WhatsApp number with country code, e.g. +91 98765 43210.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const { error } = await supabase()
      .from("profiles")
      .update({ capability_description: capability.trim() || null, phone_number: normalizedPhone })
      .eq("id", session!.user.id);
    setBusy(false);
    if (error) {
      setError(
        error.code === "PGRST204" || error.code === "42703"
          ? "The AI-matching migration hasn't been applied to the database yet."
          : error.message
      );
      return;
    }
    if (normalizedPhone) setPhone(normalizedPhone);
    setMessage("Saved.");
  }

  const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

  return (
    <div>
      <div className="border-b border-ink bg-ink text-canvas">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="font-display text-3xl font-bold">{profile?.full_name || "Your profile"}</h1>
          <p className="mt-1 text-sm text-canvas/70">
            {profile ? ROLE_LABELS[profile.role] : ""}
            {profile?.org_name ? ` · ${profile.org_name}` : ""} · {session.user.email}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {profile?.role === "institution" || profile?.role === "industry_partner" ? (
          <>
            <IntegrationNotice status={integrations} scope="routing" />
            <OrgStatusPanel userId={session.user.id} role={profile.role} />
          </>
        ) : !isDonor ? (
          <p className="border border-dashed border-mute p-6 text-center text-sm text-mute">
            Capability matching and WhatsApp requests are for NGO and relief-camp accounts.
          </p>
        ) : (
          <>
            <IntegrationNotice status={integrations} />
            <form onSubmit={save} className="space-y-4 border border-ink bg-canvas p-6">
              <label className="block text-sm">
                <span className="mb-1 block font-display font-semibold">What can you offer?</span>
                <textarea
                  rows={5}
                  maxLength={MAX_CAPABILITY_CHARS}
                  value={capability}
                  onChange={(e) => setCapability(e.target.value)}
                  placeholder="e.g. 'We run a pharmacy, can supply basic meds, bandages, and have a van for transport'"
                  className={input}
                />
                <span className="mt-1 block text-xs text-mute">
                  Our AI matcher reads this to connect you with camps whose needs fit what you can do.
                </span>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-display font-semibold">WhatsApp number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className={input}
                />
                <span className="mt-1 block text-xs text-mute">
                  Used only to send you WhatsApp requests when a camp needs what you offer. Never shown
                  publicly — only signed-in coordinators and our messaging service (Twilio) use it. Your
                  email ({session.user.email}) is shown to camps as a contact.
                </span>
              </label>
              {error && <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
              {message && <p className="text-sm font-semibold">{message}</p>}
              <button
                disabled={busy}
                className="bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save profile"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
