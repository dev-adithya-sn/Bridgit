"use client";

import { supabase } from "./supabase";

/** POSTs JSON to one of our API routes with the user's session token. */
export async function postWithSession(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: "Unexpected response from the server." }));
  return { status: res.status, json };
}
