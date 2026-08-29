"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, ChevronDown, Download, Inbox, LoaderCircle, Trash2, X } from "lucide-react";
import { formatPrivateCurrency, formatPercent } from "@/lib/formatters";

export type Tone = "positive" | "attention" | "negative" | "neutral" | "info";

export function CurrencyValue({ value, hidden = false, className = "" }: { value: number; hidden?: boolean; className?: string }) {
  return <span className={`currency-value ${hidden ? "is-hidden" : ""} ${className}`.trim()}>{formatPrivateCurrency(value, hidden)}</span>;
}

export function TrendIndicator({ value, suffix = "%", inverse = false }: { value: number | null; suffix?: string; inverse?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="trend neutral">Sem base comparativa</span>;
  const positive = inverse ? value <= 0 : value >= 0;
  return <span className={`trend ${positive ? "positive" : "negative"}`}>{value >= 0 ? "+" : ""}{suffix === "%" ? formatPercent(value) : `${value.toFixed(1)}${suffix}`}</span>;
}

export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
  trend,
  hidden,
  format = "currency",
}: {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone?: Tone;
  trend?: number | null;
  hidden?: boolean;
  format?: "currency" | "number" | "percent";
}) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <div className="kpi-head"><span>{label}</span><span className="kpi-icon"><Icon size={18} aria-hidden="true" /></span></div>
      <strong>{format === "currency" ? <CurrencyValue value={value} hidden={hidden} /> : format === "percent" ? formatPercent(value) : new Intl.NumberFormat("pt-BR").format(value)}</strong>
      <div className="kpi-foot"><small>{helper}</small>{trend !== undefined && <TrendIndicator value={trend} />}</div>
    </article>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="section-header">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
      {actions && <div className="section-actions">{actions}</div>}
    </header>
  );
}

export function PanelHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="panel-header"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  compact?: boolean;
}) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><span><Icon size={21} /></span><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function ProgressBar({ value, tone = "positive", label }: { value: number; tone?: Tone; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return <div className="progress-stack">{label && <div className="progress-label"><span>{label}</span><strong>{formatPercent(safeValue)}</strong></div>}<div className={`progress-bar tone-${tone}`} role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${safeValue}%` }} /></div></div>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Carregando dados">{Array.from({ length: rows }, (_, index) => <i key={index} style={{ width: `${92 - index * 7}%` }} />)}</div>;
}

export function ExportButton({ label = "Exportar", loading = false, onClick, menu }: { label?: string; loading?: boolean; onClick?: () => void; menu?: React.ReactNode }) {
  if (menu) return <details className="export-menu"><summary className="secondary-button"><Download size={16} />{label}<ChevronDown size={14} /></summary><div>{menu}</div></details>;
  return <button className="secondary-button" onClick={onClick} disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{label}</button>;
}

export type ToastItem = { id: number; tone: "success" | "error" | "info"; title: string; description?: string };

export function ToastViewport({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return <div className="toast-viewport" aria-live="polite">{items.map((item) => <div className={`toast toast-${item.tone}`} key={item.id}><span>{item.tone === "success" ? <Check /> : item.tone === "error" ? <AlertTriangle /> : <Download />}</span><div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div><button onClick={() => dismiss(item.id)} aria-label="Fechar aviso"><X size={16} /></button></div>)}</div>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  danger = true,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation"><div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><span className={danger ? "danger" : "attention"}>{danger ? <Trash2 /> : <AlertTriangle />}</span><h2 id="confirm-title">{title}</h2><p>{description}</p><div><button className="secondary-button" onClick={onCancel}>Cancelar</button><button className={danger ? "danger-button" : "primary-button"} onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}
