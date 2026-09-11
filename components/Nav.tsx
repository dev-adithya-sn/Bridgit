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
    <header className="sticky top-0 z-[1000] border-b border-ink bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="flex h-8 w-8 items-center justify-center bg-ink font-display text-sm text-canvas">
            B
          </span>
          <span className="hidden font-display text-lg tracking-wide sm:block">
            Bridge-It
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {[...LINKS, ...(profile?.role === "admin" ? [{ href: "/admin/moderation", label: "Moderation" }] : [])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap px-3 py-1.5 font-display font-medium ${
                pathname.startsWith(l.href)
                  ? "bg-ink text-canvas"
                  : "text-ink hover:bg-ink hover:text-canvas"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {!isSupabaseConfigured ? (
          <span className="hidden border border-dashed border-ink px-2 py-1 text-xs font-medium text-ink md:block">
            Supabase not connected
          </span>
        ) : session ? (
          <div className="flex items-center gap-2">
            <Link href="/profile" className="hidden text-right text-xs hover:underline md:block">
              <div className="font-semibold text-ink">
                {profile?.full_name || session.user.email}
              </div>
              <div className="text-mute">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </div>
            </Link>
            <button
              onClick={signOut}
              className="border border-ink px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-canvas"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="border border-ink px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-canvas"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-ink px-3 py-1.5 text-sm font-medium text-canvas hover:bg-ink/80"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
