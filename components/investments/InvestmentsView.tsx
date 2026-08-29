"use client";

import { useMemo, useState } from "react";
import { Edit3, Plus, ShieldCheck, Target, Trash2, TrendingUp, WalletCards } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import type { Goal, Investment } from "@/lib/finance/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { CurrencyValue, EmptyState, ExportButton, KpiCard, PanelHeader, ProgressBar, SectionHeader, StatusBadge } from "@/components/shared";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
const colors = ["#1f6b52", "#d9a441", "#426c8f", "#8b6f61", "#6f9385", "#7f7894"];

export function InvestmentsView({ investments, goals, analytics, hidden, onNew, onEdit, onDelete, onExport }: {
  investments: Investment[];
  goals: Goal[];
  analytics: Analytics;
  hidden: boolean;
  onNew: () => void;
  onEdit: (item: Investment) => void;
  onDelete: (item: Investment) => void;
  onExport: () => void;
}) {
  const [type, setType] = useState("all");
  const types = useMemo(() => [...new Set(investments.map((item) => item.type))], [investments]);
  const filtered = type === "all" ? investments : investments.filter((item) => item.type === type);
  const allocation = useMemo(() => types.map((name) => ({ name, value: investments.filter((item) => item.type === name).reduce((sum,item) => sum + item.value,0) })).filter((item) => item.value > 0), [investments, types]);
  const featuredGoal = goals[0];
  return <section className="investments-page section-page">
    <SectionHeader eyebrow="INVESTIMENTOS" title="Carteira e alocação" description="Acompanhe o capital investido, a composição por classe e a participação de cada ativo." actions={<><label className="select-control"><span>Classe</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Todas</option>{types.map((item) => <option key={item}>{item}</option>)}</select></label><ExportButton label="Baixar Excel" onClick={onExport}/><button className="primary-button" onClick={onNew}><Plus size={16}/>Novo investimento</button></>} />
    <div className="kpi-grid planning-kpis"><KpiCard label="Total investido" value={analytics.portfolioTotal} helper="Capital registrado na carteira" icon={WalletCards} tone="positive" hidden={hidden}/><KpiCard label="Rentabilidade média" value={analytics.averageReturn} helper="Média ponderada informada" icon={TrendingUp} tone={analytics.averageReturn >= 0 ? "positive" : "negative"} format="percent"/><KpiCard label="Reserva de emergência" value={analytics.emergencyReserve} helper={`${analytics.reserveMonths.toFixed(1)} meses de cobertura`} icon={ShieldCheck} tone="attention" hidden={hidden}/><KpiCard label="Número de ativos" value={investments.length} helper={`${types.length} classes personalizadas`} icon={Target} tone="info" format="number"/></div>
    <div className="investment-layout"><article className="panel"><PanelHeader eyebrow="ALOCAÇÃO" title="Distribuição por classe"/>{allocation.length ? <><div className="chart chart-medium"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{allocation.map((_,index) => <Cell key={index} fill={colors[index%colors.length]}/>)}</Pie><Tooltip formatter={(value) => hidden ? "R$ ••••••" : formatCurrency(Number(value))}/></PieChart></ResponsiveContainer></div><div className="composition-legend">{allocation.map((item,index) => <div key={item.name}><i style={{background:colors[index%colors.length]}}/><span>{item.name}</span><strong>{formatPercent(analytics.portfolioTotal ? item.value / analytics.portfolioTotal * 100 : 0)}</strong></div>)}</div></> : <EmptyState title="Carteira ainda vazia" description="Cadastre o primeiro investimento usando as classes que fazem sentido para você."/>}</article><article className="panel investment-goal-card"><PanelHeader eyebrow="OBJETIVO" title="Meta prioritária"/>{featuredGoal ? <><Target/><h3>{featuredGoal.name}</h3><strong><CurrencyValue value={featuredGoal.target} hidden={hidden}/></strong><ProgressBar value={featuredGoal.target ? featuredGoal.current / featuredGoal.target * 100 : 0} label="Progresso"/><p><CurrencyValue value={featuredGoal.current} hidden={hidden}/> acumulados; faltam <CurrencyValue value={Math.max(0, featuredGoal.target-featuredGoal.current)} hidden={hidden}/>.</p></> : <EmptyState title="Nenhuma meta vinculada" description="Crie uma meta em Planejamento para acompanhar o próximo objetivo da carteira." icon={Target}/>}</article></div>
    <article className="panel investment-table"><PanelHeader eyebrow="POSIÇÕES" title="Ativos registrados"/>{filtered.length ? <div className="financial-table-wrap"><table className="financial-table"><thead><tr><th>Investimento</th><th>Classe</th><th className="numeric">Valor</th><th className="numeric">Rentabilidade</th><th className="numeric">Participação</th><th aria-label="Ações"/></tr></thead><tbody>{filtered.map((item) => <tr key={item.id || item.name}><td><strong>{item.name}</strong></td><td><StatusBadge tone="neutral">{item.type}</StatusBadge></td><td className="numeric"><CurrencyValue value={item.value} hidden={hidden}/></td><td className={`numeric ${item.returnPct >= 0 ? "positive" : "negative"}`}>{formatPercent(item.returnPct)}</td><td className="numeric">{formatPercent(analytics.portfolioTotal ? item.value / analytics.portfolioTotal*100 : 0)}</td><td><div className="row-actions"><button onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}><Edit3 size={15}/></button><button className="danger" onClick={() => onDelete(item)} aria-label={`Excluir ${item.name}`}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum investimento nesta seleção" description="Ajuste a classe ou cadastre um novo ativo." action={<button className="text-button" onClick={onNew}>Adicionar investimento</button>}/>}</article>
  </section>;
}
