"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Plus, Repeat2, Trash2, TrendingUp } from "lucide-react";
import type { Account, Category, Subscription, Transaction } from "@/lib/finance/types";
import { formatDate } from "@/lib/formatters";
import { CurrencyValue, EmptyState, ExportButton, KpiCard, PanelHeader, SectionHeader, StatusBadge } from "@/components/shared";

export function SubscriptionsView({ subscriptions, transactions, categories, accounts, hidden, onSave, onArchive, onExport }: {
  subscriptions: Subscription[];
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  hidden: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onArchive: (item: Subscription) => void;
  onExport: () => void;
}) {
  const [sort, setSort] = useState<"cost-desc" | "cost-asc" | "name">("cost-desc");
  const active = useMemo(() => subscriptions.filter((item) => item.status === "Ativa").sort((a,b) => sort === "cost-desc" ? b.value-a.value : sort === "cost-asc" ? a.value-b.value : a.name.localeCompare(b.name,"pt-BR")), [subscriptions, sort]);
  const monthly = active.reduce((sum,item) => sum+item.value,0);
  const largest = active[0];
  const futureInstallments = transactions.filter((item) => item.type === "saida" && Number(item.installmentTotal||1)>1 && item.date > new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date));
  return <section className="subscriptions-page section-page">
    <SectionHeader eyebrow="ASSINATURAS" title="Custos recorrentes e impacto anual" description="Entenda o peso mensal e anual das assinaturas e acompanhe parcelas futuras." actions={<><label className="select-control"><span>Ordenar</span><select value={sort} onChange={(event)=>setSort(event.target.value as typeof sort)}><option value="cost-desc">Maior custo</option><option value="cost-asc">Menor custo</option><option value="name">Nome</option></select></label><ExportButton label="Baixar Excel" onClick={onExport}/></>} />
    <div className="kpi-grid planning-kpis"><KpiCard label="Custo mensal" value={monthly} helper={`${active.length} assinaturas ativas`} icon={Repeat2} tone="attention" hidden={hidden}/><KpiCard label="Impacto anual" value={monthly*12} helper="Projeção matemática em 12 meses" icon={CalendarDays} tone="negative" hidden={hidden}/><KpiCard label="Maior assinatura" value={largest?.value||0} helper={largest?.name||"Nenhuma ativa"} icon={TrendingUp} tone="info" hidden={hidden}/><KpiCard label="Quantidade ativa" value={active.length} helper={`${subscriptions.length-active.length} inativas`} icon={Repeat2} tone="neutral" format="number"/></div>
    <div className="subscriptions-layout">
      <article className="panel planning-form-panel"><PanelHeader eyebrow="NOVA ASSINATURA" title="Cadastro de recorrência"/><form className="standard-form" onSubmit={onSave}><label>Nome<input name="name" placeholder="Ex.: Netflix ou software" required/></label><label>Categoria<select name="category">{categories.filter((item)=>item.macro!=="Receita").map((item)=><option key={item.name}>{item.name}</option>)}</select></label><label>Conta ou cartão<select name="account"><option>Não informado</option>{accounts.map((item)=><option key={item.id}>{item.name}</option>)}</select></label><label>Custo mensal<input name="value" type="number" min="0.01" step="0.01" required/></label><label>Dia da cobrança<input name="billingDay" type="number" min="1" max="31" defaultValue="1" required/></label><button className="primary-button" type="submit"><Plus size={15}/>Adicionar assinatura</button></form></article>
      <article className="panel"><PanelHeader eyebrow="CUSTOS ATIVOS" title="Assinaturas por impacto"/>{active.length ? <div className="subscription-analytics-list">{active.map((item)=><div key={item.id}><span className="subscription-day"><small>DIA</small><strong>{String(item.billingDay).padStart(2,"0")}</strong></span><span><strong>{item.name}</strong><small>{item.category} · {item.account}</small></span><span><b><CurrencyValue value={item.value} hidden={hidden}/>/mês</b><small><CurrencyValue value={item.value*12} hidden={hidden}/> ao ano</small></span><button className="icon-button danger" onClick={()=>onArchive(item)} aria-label={`Arquivar ${item.name}`}><Trash2 size={15}/></button></div>)}</div> : <EmptyState title="Nenhuma assinatura ativa" description="Cadastre a primeira assinatura para visualizar o impacto anual." icon={Repeat2}/>}</article>
    </div>
    <article className="panel full-module-panel"><PanelHeader eyebrow="AGENDA FUTURA" title="Parcelas já comprometidas"/>{futureInstallments.length ? <div className="future-table">{futureInstallments.slice(0,24).map((item)=><div key={item.id}><CalendarDays/><span><strong>{item.description}</strong><small>{formatDate(item.date)} · {item.account}</small></span><StatusBadge tone="attention">{item.installmentCurrent}/{item.installmentTotal}</StatusBadge><CurrencyValue value={item.value} hidden={hidden}/></div>)}</div> : <EmptyState title="Nenhuma parcela futura" description="Compras parceladas aparecerão aqui em ordem de vencimento."/>}</article>
  </section>;
}
