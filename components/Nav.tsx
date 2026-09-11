"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const LINKS = [
  { href: "/problems", label: "Problem Board" },
  { href: "/resources", label: "Resources & Needs" },
  { href: "/matches", label: "Smart Matching" },
  { href: "/dashboard", label: "Dashboard" },
];

const ROLE_LABELS: Record<string, string> = {
  citizen: "Citizen",
  ngo: "NGO",
  camp: "Relief Camp",
  university_team: "University Team",
  admin: "Admin",
};

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, profile } = useSession();

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-sm text-white">
            JH
          </span>
          <span className="hidden sm:block">
            Sahayata<span className="text-blue-700">Setu</span>
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium ${
                pathname.startsWith(l.href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {!isSupabaseConfigured ? (
          <span className="hidden rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 md:block">
            Supabase not connected
          </span>
        ) : session ? (
          <div className="flex items-center gap-2">
            <div className="hidden text-right text-xs md:block">
              <div className="font-semibold text-slate-800">
                {profile?.full_name || session.user.email}
              </div>
              <div className="text-slate-500">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
