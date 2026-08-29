"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import type { WealthItem } from "@/lib/finance/types";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { CurrencyValue, EmptyState, ExportButton, KpiCard, PanelHeader, SectionHeader, StatusBadge } from "@/components/shared";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
const colors = ["#1f6b52", "#d9a441", "#426c8f", "#8b6f61", "#6f9385", "#7f7894"];

export function WealthView({ items, analytics, hidden, onSave, onDelete, onExport }: {
  items: WealthItem[];
  analytics: Analytics;
  hidden: boolean;
  onSave: (values: Record<string, unknown>, editingId?: number) => Promise<void>;
  onDelete: (item: WealthItem) => void;
  onExport: () => void;
}) {
  const [editing, setEditing] = useState<WealthItem | null>(null);
  const composition = useMemo(() => {
    const map = new Map<string, number>();
    items.filter((item) => item.kind === "Ativo").forEach((item) => map.set(item.group, (map.get(item.group) || 0) + Math.max(0, item.value - Number(item.remainingDebt || 0))));
    return [...map.entries()].map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  }, [items]);
  const itemNet = (item: WealthItem) => item.kind === "Ativo" ? item.value - Number(item.remainingDebt || 0) : -item.value;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSave(values, editing?.id);
    setEditing(null);
    event.currentTarget.reset();
  }

  return <section className="wealth-page section-page">
    <SectionHeader eyebrow="PATRIMÔNIO" title="Visão patrimonial consolidada" description="Ativos, passivos e valor líquido organizados para leitura executiva." actions={<ExportButton label="Baixar Excel" onClick={onExport}/>} />
    <div className="kpi-grid planning-kpis"><KpiCard label="Ativos brutos" value={analytics.grossAssets} helper="Imóveis, veículos, contas e investimentos" icon={ArrowUpRight} tone="positive" hidden={hidden}/><KpiCard label="Passivos" value={analytics.liabilities} helper="Dívidas e obrigações registradas" icon={ArrowDownRight} tone="negative" hidden={hidden}/><KpiCard label="Patrimônio líquido" value={analytics.netWorth} helper="Ativos menos passivos" icon={Landmark} tone={analytics.netWorth >= 0 ? "positive" : "negative"} hidden={hidden}/></div>
    <div className="wealth-layout">
      <article className="panel wealth-composition"><PanelHeader eyebrow="COMPOSIÇÃO" title="Patrimônio por grupo"/>{composition.length ? <><div className="chart chart-medium"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={composition} dataKey="value" nameKey="name" innerRadius={65} outerRadius={98} paddingAngle={3}>{composition.map((_, index) => <Cell key={index} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value) => hidden ? "R$ ••••••" : formatCurrency(Number(value))}/></PieChart></ResponsiveContainer></div><div className="composition-legend">{composition.map((item,index) => <div key={item.name}><i style={{background:colors[index%colors.length]}}/><span>{item.name}</span><strong>{formatPercent(analytics.netWorth ? item.value / Math.max(analytics.grossAssets,1)*100 : 0)}</strong></div>)}</div></> : <EmptyState title="Composição ainda indisponível" description="Cadastre ativos para visualizar a distribuição patrimonial real." icon={Landmark}/>}</article>
      <article className="panel planning-form-panel"><PanelHeader eyebrow={editing ? "EDIÇÃO" : "NOVO ITEM"} title={editing ? `Editar ${editing.name}` : "Cadastrar ativo ou passivo"}/><form className="standard-form" onSubmit={submit} key={editing?.id || "new"}><label>Item<input name="name" defaultValue={editing?.name} placeholder="Ex.: Casa, veículo ou financiamento" required/></label><label>Natureza<select name="kind" defaultValue={editing?.kind || "Ativo"}><option>Ativo</option><option>Passivo</option></select></label><label>Grupo<input name="group" defaultValue={editing?.group} placeholder="Ex.: Imóveis" required/></label><label>Valor bruto<input name="value" type="number" min="0" step="0.01" defaultValue={editing?.value} required/></label><label>Dívida restante<input name="remainingDebt" type="number" min="0" step="0.01" defaultValue={editing?.remainingDebt || 0}/></label><div className="form-actions"><button className="primary-button" type="submit"><Plus size={15}/>{editing ? "Salvar alterações" : "Adicionar item"}</button>{editing && <button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button>}</div></form></article>
    </div>
    <article className="panel wealth-table-panel"><PanelHeader eyebrow="CONSOLIDADO" title="Itens patrimoniais"/>{items.length ? <div className="financial-table-wrap"><table className="financial-table"><thead><tr><th>Item</th><th>Tipo</th><th>Grupo</th><th className="numeric">Valor bruto</th><th className="numeric">Dívida</th><th className="numeric">Valor líquido</th><th aria-label="Ações"/></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><StatusBadge tone={item.kind === "Ativo" ? "positive" : "negative"}>{item.kind}</StatusBadge></td><td>{item.group}</td><td className="numeric"><CurrencyValue value={item.value} hidden={hidden}/></td><td className="numeric negative"><CurrencyValue value={item.kind === "Ativo" ? Number(item.remainingDebt || 0) : item.value} hidden={hidden}/></td><td className={`numeric ${itemNet(item) >= 0 ? "positive" : "negative"}`}><CurrencyValue value={itemNet(item)} hidden={hidden}/></td><td><div className="row-actions"><button onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}><Pencil size={15}/></button><button className="danger" onClick={() => onDelete(item)} aria-label={`Excluir ${item.name}`}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum item patrimonial" description="Cadastre ativos e passivos para formar a visão consolidada."/>}</article>
  </section>;
}
