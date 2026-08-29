"use client";

import { Database, Download, FileJson, FileSpreadsheet, History, ShieldCheck } from "lucide-react";
import type { AuditEvent, BackupEvent } from "@/lib/finance/types";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { EmptyState, PanelHeader, SectionHeader, StatusBadge } from "@/components/shared";

function auditRow(event: AuditEvent) {
  try {
    const parsed = JSON.parse(event.snapshot) as Record<string, unknown>;
    const item = (parsed.after && typeof parsed.after === "object" ? parsed.after : parsed) as Record<string, unknown>;
    return { ...event, description: String(item.description || "Lançamento"), value: Number(item.value || 0) };
  } catch { return { ...event, description: "Lançamento", value: 0 }; }
}

export function HistoryView({ events, backups, hidden, syncLabel, onBackupJson, onFullExcel }: { events: AuditEvent[]; backups: BackupEvent[]; hidden: boolean; syncLabel: string; onBackupJson: () => void; onFullExcel: () => void }) {
  const rows = events.map(auditRow);
  return <section className="history-page section-page"><SectionHeader eyebrow="DADOS E SEGURANÇA" title="Histórico e backup" description="Rastreabilidade dos lançamentos e cópias portáteis dos seus dados." actions={<><button className="secondary-button" onClick={onBackupJson}><FileJson size={16}/>Baixar backup completo</button><button className="primary-button" onClick={onFullExcel}><FileSpreadsheet size={16}/>Baixar Excel completo</button></>}/>
    <div className="security-status-grid"><article><ShieldCheck/><span><small>SINCRONIZAÇÃO</small><strong>{syncLabel}</strong><p>Identidade e persistência protegidas pelo Worker.</p></span></article><article><Database/><span><small>BANCO</small><strong>financas-pessoais-db</strong><p>Cloudflare D1 existente; nenhuma recriação.</p></span></article><article><Download/><span><small>ÚLTIMO BACKUP</small><strong>{backups[0] ? formatDateTime(backups[0].createdAt) : "Ainda não registrado"}</strong><p>{backups[0] ? backups[0].kind : "Gere JSON ou Excel completo."}</p></span></article></div>
    <section className="backup-explainer"><ShieldCheck/><div><strong>Backup preserva dados e histórico</strong><p>O JSON contém os registros completos para recuperação técnica. O Excel organiza as informações para leitura, análise e arquivo pessoal.</p></div></section>
    <article className="panel audit-panel"><PanelHeader eyebrow="TRILHA DE AUDITORIA" title="Eventos de movimentações" action={<span>{rows.length} eventos preservados</span>}/>{rows.length?<div className="audit-list">{rows.map((item)=><div key={item.id}><StatusBadge tone={item.action === "Arquivado" ? "negative" : item.action === "Atualizado" ? "info" : "positive"}>{item.action}</StatusBadge><span><strong>{item.description}</strong><small>Lançamento #{item.transactionId} · {formatDateTime(item.createdAt)}</small></span><b>{item.value ? hidden ? "R$ ••••••" : formatCurrency(item.value) : "—"}</b></div>)}</div>:<EmptyState title="Histórico em formação" description="Criações, alterações e arquivamentos de lançamentos aparecerão aqui." icon={History}/>}</article>
  </section>;
}
