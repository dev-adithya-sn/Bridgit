"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once the team has pasted real Supabase keys into .env.local */
export const isSupabaseConfigured =
  url.startsWith("https://") && anonKey.length > 20;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      isSupabaseConfigured ? url : "https://placeholder.supabase.co",
      isSupabaseConfigured ? anonKey : "placeholder-anon-key"
    );
  }
  return client;
}
