"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { postWithSession } from "@/lib/authFetch";
import { normalizePhone } from "@/lib/phone";
import { MAX_CAPABILITY_CHARS } from "@/lib/capabilityLimits";
import { JHARKHAND_DISTRICTS, PROBLEM_DOMAINS } from "@/lib/types";

const ROLES = [
  { value: "citizen", label: "Citizen / Volunteer", desc: "Report problems on the ground" },
  { value: "ngo", label: "NGO / Donor", desc: "Post supplies you can provide" },
  { value: "camp", label: "Relief Camp", desc: "Post what your camp needs" },
  { value: "university_team", label: "University Team", desc: "Claim and solve problems" },
  { value: "institution", label: "Academic Institution", desc: "Register to receive problems routed to your domains" },
  { value: "industry_partner", label: "Industry Partner", desc: "Offer funding, mentorship or prototyping support" },
  { value: "admin", label: "Government / Admin", desc: "Oversee the response" },
];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [capability, setCapability] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingInstitution, setPendingInstitution] = useState<string | null>(null);

  // institution / industry partner fields
  const [district, setDistrict] = useState("Ranchi");
  const [domains, setDomains] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [hasIncubationCell, setHasIncubationCell] = useState(false);
  const [sector, setSector] = useState("");

  const isDonor = role === "ngo" || role === "camp";
  const isInstitution = role === "institution";
  const isIndustry = role === "industry_partner";

  function toggleDomain(d: string) {
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedPhone = isDonor && phone.trim() ? normalizePhone(phone) : null;
    if (isDonor && phone.trim() && !normalizedPhone) {
      setError("Enter the WhatsApp number with country code, e.g. +91 98765 43210.");
      return;
    }
    if ((isInstitution || isIndustry) && domains.length === 0) {
      setError("Pick at least one domain.");
      return;
    }
    if (isIndustry && sector.trim().length < 2) {
      setError("Describe the sector (e.g. Agritech, Healthtech MSME, CSR).");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await supabase().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          org_name: orgName || null,
          ...(isDonor
            ? { capability_description: capability.trim() || null, phone_number: normalizedPhone }
            : {}),
        },
      },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }

    if (isInstitution) {
      const { status, json } = await postWithSession("/api/institutions", {
        name: orgName || fullName,
        district,
        domains,
        description: description.trim() || null,
        hasIncubationCell,
      });
      setBusy(false);
      if (status !== 201) {
        // The account exists either way; institution registration can be retried from /profile.
        setError(json?.error ?? "Account created, but registering the institution failed. You can try again from your profile.");
        router.push("/profile");
        return;
      }
      setPendingInstitution(json.institution?.name ?? orgName ?? fullName);
      return;
    }

    if (isIndustry) {
      const { status, json } = await postWithSession("/api/industry-partners", {
        name: orgName || fullName,
        sector: sector.trim(),
        domains,
        capabilities: description.trim() || null,
      });
      setBusy(false);
      if (status !== 201) {
        setError(json?.error ?? "Account created, but registering the industry partner failed. You can try again from your profile.");
        router.push("/profile");
        return;
      }
      router.push("/problems");
      return;
    }

    setBusy(false);
    router.push("/problems");
  }

  const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

  if (pendingInstitution) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Institution registered</h1>
        <div className="mt-5 space-y-4 border border-ink bg-canvas p-6">
          <p className="border border-dashed border-ink px-3 py-2 text-sm font-semibold uppercase tracking-wide text-ink">
            Pending verification
          </p>
          <p className="text-sm">
            <strong>{pendingInstitution}</strong> is now listed, but you&apos;re not yet a verified representative — an
            admin needs to confirm that before you can accept routing suggestions on its behalf. This can take a
            little while; you can check your status any time from your profile.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => router.push("/profile")}
            className="bg-ink px-4 py-2 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80"
          >
            Go to profile
          </button>
          <button
            onClick={() => router.push("/problems")}
            className="border border-ink px-4 py-2 font-display font-semibold uppercase tracking-wide hover:bg-ink hover:text-canvas"
          >
            Browse problems
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-mute">
        Pick the role that matches who you are — it shapes what you can do.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="space-y-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 border p-3 ${
                role === r.value
                  ? "border-ink bg-ink text-canvas"
                  : "border-ink bg-canvas hover:bg-ink/5"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="accent-ink"
              />
              <span>
                <span className="block font-display text-sm font-semibold">{r.label}</span>
                <span className={`block text-xs ${role === r.value ? "text-canvas/70" : "text-mute"}`}>
                  {r.desc}
                </span>
              </span>
            </label>
          ))}
        </div>
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={input}
        />
        {(role === "ngo" || role === "camp" || role === "university_team" || isInstitution || isIndustry) && (
          <input
            placeholder={
              isInstitution
                ? "Institution name"
                : isIndustry
                  ? "Company / organisation name"
                  : role === "university_team"
                    ? "College / team name"
                    : "Organisation / camp name"
            }
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className={input}
          />
        )}
        {isDonor && (
          <div className="space-y-4 border border-ink p-4">
            <label className="block text-sm">
              <span className="mb-1 block font-display font-semibold">What can you offer?</span>
              <textarea
                rows={4}
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
                Optional. When a camp needs what you offer, it can send you a WhatsApp request to confirm
                you can help. Your number is never shown publicly — only signed-in coordinators and our
                messaging service (Twilio) use it. Your email will be shown to camps as a contact.
              </span>
            </label>
          </div>
        )}
        {(isInstitution || isIndustry) && (
          <div className="space-y-4 border border-ink p-4">
            {isInstitution && (
              <label className="block text-sm">
                <span className="mb-1 block font-display font-semibold">District</span>
                <select value={district} onChange={(e) => setDistrict(e.target.value)} className={input}>
                  {JHARKHAND_DISTRICTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            )}
            {isIndustry && (
              <label className="block text-sm">
                <span className="mb-1 block font-display font-semibold">Sector</span>
                <input
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="e.g. Agritech, Healthtech MSME, CSR"
                  className={input}
                />
              </label>
            )}
            <div>
              <span className="mb-1 block font-display text-sm font-semibold">Domains</span>
              <div className="flex flex-wrap gap-2">
                {PROBLEM_DOMAINS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDomain(d)}
                    className={`border px-2.5 py-1 text-xs font-semibold uppercase ${
                      domains.includes(d) ? "border-ink bg-ink text-canvas" : "border-ink bg-canvas text-ink"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-mute">
                Our routing engine reads these (and the description below) to match problems to you.
              </span>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-display font-semibold">
                {isInstitution ? "Research focus / labs / expertise" : "Capabilities"}
              </span>
              <textarea
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isInstitution
                    ? "e.g. 'Civil engineering department with a water-testing lab; runs a student incubation cell.'"
                    : "e.g. 'We offer seed funding, mentorship and prototyping support for agritech and healthtech ideas.'"
                }
                className={input}
              />
            </label>
            {isInstitution && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasIncubationCell}
                  onChange={(e) => setHasIncubationCell(e.target.checked)}
                  className="accent-ink"
                />
                Has an incubation cell
              </label>
            )}
            <p className="border-t border-ink pt-3 text-xs text-mute">
              Registering creates your listing right away, but you won&apos;t be a{" "}
              <strong className="text-ink">verified</strong> representative until an admin confirms it — that&apos;s
              what lets you accept routing suggestions on the institution&apos;s behalf.
            </p>
          </div>
        )}
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <input
          required
          type="password"
          minLength={6}
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        {error && <p className="bg-ink px-3 py-2 text-sm font-medium text-canvas">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-ink py-2.5 font-display font-semibold uppercase tracking-wide text-canvas hover:bg-ink/80 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-mute">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
