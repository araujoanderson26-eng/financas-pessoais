"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import type { SyncState } from "@/hooks/useFinanceData";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import { formatMonth } from "@/lib/formatters";

type FinancialAlerts = ReturnType<typeof getFinancialAnalytics>["alerts"];

export function AlertsButton({ alerts, selectedMonth, syncState }: {
  alerts: FinancialAlerts;
  selectedMonth: string;
  syncState: SyncState;
}) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 0 });
  const available = syncState === "saved" || syncState === "saving";
  const count = available ? alerts.length : 0;

  const updatePosition = useCallback(() => {
    if (!trigger.current) return;
    const bounds = trigger.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const panelWidth = Math.min(380, width - 24);
    const top = Math.min(bounds.bottom + 10, viewportTop + height - 24);
    setPosition({
      top,
      left: Math.max(viewportLeft + 12, Math.min(bounds.right - panelWidth, viewportLeft + width - panelWidth - 12)),
      maxHeight: Math.max(0, viewportTop + height - top - 12),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open, updatePosition]);

  return <>
    <button
      ref={trigger}
      type="button"
      className="icon-button alerts-button"
      popoverTarget={panelId}
      onClick={updatePosition}
      aria-label={available ? `${count} alertas financeiros` : "Alertas financeiros"}
      aria-expanded={open}
      aria-controls={panelId}
      aria-haspopup="dialog"
      title="Alertas financeiros"
    ><Bell />{count > 0 && <span>{count}</span>}</button>
    <section
      id={panelId}
      className="alerts-popover"
      popover="auto"
      role="dialog"
      aria-labelledby={`${panelId}-title`}
      onToggle={(event) => setOpen(event.newState === "open")}
      style={position}
    >
      <header>
        <div><h2 id={`${panelId}-title`}>Alertas financeiros</h2><p>{formatMonth(selectedMonth)}</p></div>
        <button type="button" className="icon-button" popoverTarget={panelId} popoverTargetAction="hide" aria-label="Fechar alertas"><X /></button>
      </header>
      {!available ? <p className="alerts-popover-message" role="status">{syncState === "loading" ? "Carregando alertas…" : "Não foi possível carregar os alertas. Verifique a sincronização dos dados."}</p>
        : count === 0 ? <p className="alerts-popover-message">Nenhum alerta financeiro pendente neste período.</p>
        : <ul aria-label="Alertas pendentes">{alerts.map((alert) => <li key={alert.title}>
          <StatusBadge tone={alert.level === "important" ? "negative" : alert.level === "attention" ? "attention" : "info"}>{alert.level === "important" ? "Importante" : alert.level === "attention" ? "Atenção" : "Informação"}</StatusBadge>
          <strong>{alert.title}</strong><p>{alert.text}</p>
        </li>)}</ul>}
    </section>
  </>;
}
