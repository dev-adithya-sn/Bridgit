import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Reads the caller's Supabase access token from `Authorization: Bearer …`. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * A server-side Supabase client acting as the calling user: requests carry
 * their JWT, so row-level security applies exactly as it does in the browser.
 */
export function supabaseAsUser(token: string): SupabaseClient {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Privileged server-side client using the service-role key, which bypasses
 * row-level security. Only for saving posts after moderation; never import
 * this into client code. Returns null when the key isn't configured.
 */
export function supabaseService(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SERVICE_KEY_HINT =
  "Posting is disabled until SUPABASE_SERVICE_ROLE_KEY is added to the server environment (see README).";

/** Anonymous server-side client (public data only). */
export function supabaseAnon(): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Postgres/PostgREST error codes meaning "migration 001 hasn't been run". */
export function isMissingSchemaError(error: { code?: string } | null): boolean {
  return !!error && ["42703", "42P01", "PGRST204", "PGRST205"].includes(error.code ?? "");
}

export const MIGRATION_HINT =
  "Database is missing the AI-matching columns. Run supabase/migrations/001_llm_matching_outreach.sql in the Supabase SQL Editor.";

export const MODERATION_MIGRATION_HINT =
  "Database is missing the moderation columns. Run supabase/migrations/002_community_qa_moderation.sql in the Supabase SQL Editor.";

/** Verifies the caller's session; returns their user id or null. */
export async function authenticatedUserId(token: string): Promise<string | null> {
  const { data, error } = await supabaseAsUser(token).auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}
