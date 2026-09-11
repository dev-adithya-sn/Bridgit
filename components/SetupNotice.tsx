"use client";

import { isSupabaseConfigured } from "@/lib/supabase";

/** Friendly banner shown until the team pastes Supabase keys into .env.local */
export default function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mx-auto mt-4 max-w-6xl px-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Setup needed:</strong> Supabase isn&apos;t connected yet, so data
        won&apos;t load. Create a free project at{" "}
        <a href="https://supabase.com" className="underline" target="_blank" rel="noreferrer">
          supabase.com
        </a>
        , run <code className="rounded bg-amber-100 px-1">supabase/schema.sql</code>{" "}
        and <code className="rounded bg-amber-100 px-1">supabase/seed.sql</code> in its
        SQL Editor, then paste the project URL and anon key into{" "}
        <code className="rounded bg-amber-100 px-1">.env.local</code> and restart the app.
        Full steps are in the README.
      </div>
    </div>
  );
}
