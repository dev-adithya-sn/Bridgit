"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ROLES = [
  { value: "citizen", label: "Citizen / Volunteer", desc: "Report problems on the ground" },
  { value: "ngo", label: "NGO / Donor", desc: "Post supplies you can provide" },
  { value: "camp", label: "Relief Camp", desc: "Post what your camp needs" },
  { value: "university_team", label: "University Team", desc: "Claim and solve problems" },
  { value: "admin", label: "Government / Admin", desc: "Oversee the response" },
];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, org_name: orgName || null } },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/problems");
  }

  const input = "w-full border border-ink bg-white px-3 py-2 outline-none";

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
        {(role === "ngo" || role === "camp" || role === "university_team") && (
          <input
            placeholder={
              role === "university_team" ? "College / team name" : "Organisation / camp name"
            }
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className={input}
          />
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
