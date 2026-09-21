"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, EMPTY_FINANCE_DATA, type FinanceData } from "@/lib/finance/types";

export type SyncState = "loading" | "saving" | "saved" | "local" | "error";

export function useFinanceData() {
  const [data, setData] = useState<FinanceData>(EMPTY_FINANCE_DATA);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async (quiet = false) => {
    const requestRevision = ++revision.current;
    if (!quiet) setSyncState("loading");
    try {
      const response = await fetch("/api/finance", { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(30000) });
      if (requestRevision !== revision.current) return null;
      if (!response.ok) {
        if (response.status === 401) {
          setSyncState("error");
          setData(EMPTY_FINANCE_DATA);
          setError("Sessão inválida ou expirada. Entre novamente pelo Cloudflare Access.");
          return null;
        }
        const failure = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(failure.error || "Não foi possível carregar os dados.");
      }
      const payload = await response.json() as Partial<FinanceData>;
      if (requestRevision !== revision.current) return payload;
      setData((current) => ({
        ...EMPTY_FINANCE_DATA,
        ...payload,
        settings: { ...DEFAULT_SETTINGS, ...(payload.settings || current.settings) },
      }));
      setSyncState("saved");
      setError(null);
      return payload;
    } catch (cause) {
      if (requestRevision !== revision.current) return null;
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
    if (saving.current) throw new Error("Aguarde a gravação em andamento antes de enviar outra alteração.");
    saving.current = true;
    ++revision.current;
    setSyncState("saving");
    setError(null);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }).catch(() => { throw new Error("Não foi possível confirmar a gravação. Recarregue os dados e confira o registro antes de repetir a operação."); });
      const result = await response.json().catch(() => { throw new Error("Resposta de gravação inválida. Recarregue os dados antes de repetir a operação."); }) as Record<string, unknown>;
      if (!response.ok) throw new Error(String(result.error || "Não foi possível salvar."));
      if (options.refresh !== false) {
        const updated = await refresh(true);
        if (!updated) setError("A alteração foi salva, mas a tela não pôde ser atualizada. Recarregue os dados; não repita o cadastro.");
      }
      else setSyncState("saved");
      return result;
    } catch (cause) {
      setSyncState("error");
      const message = cause instanceof Error ? cause.message : "Falha ao salvar.";
      setError(message);
      throw new Error(message);
    } finally {
      saving.current = false;
    }
  }, [refresh]);

  return { data, setData, syncState, setSyncState, error, refresh, sendAction };
}
