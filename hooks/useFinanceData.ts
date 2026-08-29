"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, EMPTY_FINANCE_DATA, type FinanceData } from "@/lib/finance/types";

export type SyncState = "loading" | "saving" | "saved" | "local" | "error";

export function useFinanceData() {
  const [data, setData] = useState<FinanceData>(EMPTY_FINANCE_DATA);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setSyncState("loading");
    try {
      const response = await fetch("/api/finance", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        if (response.status === 401) {
          setSyncState("local");
          setError("A sincronização exige a identidade configurada no Cloudflare Access.");
          return null;
        }
        throw new Error("Não foi possível carregar os dados.");
      }
      const payload = await response.json() as Partial<FinanceData>;
      setData((current) => ({
        ...EMPTY_FINANCE_DATA,
        ...payload,
        settings: { ...DEFAULT_SETTINGS, ...(payload.settings || current.settings) },
      }));
      setSyncState("saved");
      setError(null);
      return payload;
    } catch (cause) {
      setSyncState("error");
      setError(cause instanceof Error ? cause.message : "Falha de sincronização.");
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = data.settings.theme;
    root.dataset.density = data.settings.density;
    root.classList.toggle("privacy-mode", data.settings.hideValues);
  }, [data.settings.density, data.settings.hideValues, data.settings.theme]);

  const sendAction = useCallback(async (payload: Record<string, unknown>, options: { refresh?: boolean } = {}) => {
    setSyncState("saving");
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(result.error || "Não foi possível salvar."));
      if (options.refresh !== false) await refresh(true);
      else setSyncState("saved");
      return result;
    } catch (cause) {
      setSyncState("error");
      const message = cause instanceof Error ? cause.message : "Falha ao salvar.";
      setError(message);
      throw new Error(message);
    }
  }, [refresh]);

  return { data, setData, syncState, setSyncState, error, refresh, sendAction };
}
