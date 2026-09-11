"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "./supabase";

export interface IntegrationStatus {
  llm: boolean; // GEMINI_API_KEY set
  twilio: boolean;
  serviceKey: boolean; // SUPABASE_SERVICE_ROLE_KEY set
  failsafeApprove: boolean; // MODERATION_FAILSAFE=approve
  migration: boolean; // migration 001 applied
  moderation: boolean; // migration 002 applied
}

const NONE: IntegrationStatus = {
  llm: false,
  twilio: false,
  serviceKey: false,
  failsafeApprove: false,
  migration: false,
  moderation: false,
};

/** Which optional integrations the server has configured (null while loading). */
export function useIntegrationStatus(): IntegrationStatus | null {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then((s) => setStatus({ ...NONE, ...s }))
      .catch(() => setStatus(NONE));
  }, []);
  return status;
}
