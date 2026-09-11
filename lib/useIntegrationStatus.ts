"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "./supabase";

export interface IntegrationStatus {
  llm: boolean;
  twilio: boolean;
  migration: boolean;
}

/** Which optional integrations the server has configured (null while loading). */
export function useIntegrationStatus(): IntegrationStatus | null {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetch("/api/integrations/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ llm: false, twilio: false, migration: false }));
  }, []);
  return status;
}
