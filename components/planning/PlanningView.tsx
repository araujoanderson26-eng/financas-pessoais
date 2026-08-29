"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, CreditCard, Landmark, Plus, Repeat2, Target, Trash2, WalletCards } from "lucide-react";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import type { FinanceData } from "@/lib/finance/types";
import { formatDate, formatPercent } from "@/lib/formatters";
import { CurrencyValue, EmptyState, ExportButton, KpiCard, PanelHeader, ProgressBar, SectionHeader, StatusBadge } from "@/components/shared";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
type PlanningSection = "orcamento" | "contas" | "cartoes" | "metas" | "recorrencias" | "parcelamentos";

export function PlanningView({ data, analytics, selectedMonth, hidden, onSave, onDelete, onExport }: {
  data: FinanceData;
  analytics: Analytics;
  selectedMonth: string;
  hidden: boolean;
  onSave: (event: FormEvent<HTMLFormElement>, kind: "account" | "budget" | "goal") => void;
  onDelete: (entity: "account" | "budget" | "goal", id: number, label: string) => void;
  onExport: () => void;
}) {
  const [section, setSection] = useState<PlanningSection>("orcamento");
  const availableBudget = analytics.budgetTotal - analytics.totals.expenses;
  const nonCardAccounts = data.accounts.filter((item) => item.type !== "Cartão de crédito");
  const cards = data.accounts.filter((item) => item.type === "Cartão de crédito");
  const recurringTransactions = data.transactions.filter((item) => item.recurrence && item.recurrence !== "Não");
  const goalRows = useMemo(() => data.goals.map((goal) => {
    const now = new Date();
    const deadline = new Date(`${goal.deadline}T12:00:00`);
    const monthsRemaining = Math.max(0, (deadline.getFullYear() - now.getFullYear()) * 12 + deadline.getMonth() - now.getMonth());
    const missing = Math.max(0, goal.target - goal.current);
    return { ...goal, missing, monthsRemaining, monthlySuggestion: monthsRemaining ? missing / monthsRemaining : missing };
  }), [data.goals]);

  return <section className="planning-page section-page">
    <SectionHeader eyebrow="PLANEJAMENTO" title="Centro de planejamento" description="Organize o orçamento, contas, cartões, metas e compromissos futuros em um só lugar." actions={<ExportButton label="Baixar Excel" onClick={onExport}/>} />
    <div className="kpi-grid planning-kpis"><KpiCard label="Orçamento total" value={analytics.budgetTotal} helper={selectedMonth} icon={WalletCards} tone="info" hidden={hidden}/><KpiCard label="Realizado" value={analytics.totals.expenses} helper={`${formatPercent(analytics.budgetTotal ? analytics.totals.expenses / analytics.budgetTotal * 100 : 0)} consumido`} icon={Landmark} tone={availableBudget >= 0 ? "positive" : "negative"} hidden={hidden}/><KpiCard label="Disponível" value={availableBudget} helper={availableBudget >= 0 ? "Ainda não utilizado" : "Acima do orçamento"} icon={Target} tone={availableBudget >= 0 ? "positive" : "negative"} hidden={hidden}/><KpiCard label="Compromissos recorrentes" value={analytics.recurringCommitment} helper="Lançamentos recorrentes + assinaturas" icon={Repeat2} tone="attention" hidden={hidden}/></div>

    <nav className="module-tabs" aria-label="Seções do planejamento">
      {([
        ["orcamento", "Orçamento mensal"], ["contas", "Contas"], ["cartoes", "Cartões"], ["metas", "Metas"], ["recorrencias", "Despesas recorrentes"], ["parcelamentos", "Parcelamentos futuros"],
      ] as Array<[PlanningSection,string]>).map(([id,label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}
    </nav>

    {section === "orcamento" && <div className="planning-layout">
      <article className="panel planning-form-panel"><PanelHeader eyebrow="NOVO LIMITE" title="Orçamento por categoria"/><p>Defina quanto pretende gastar em cada categoria no mês selecionado.</p><form className="standard-form" onSubmit={(event) => onSave(event, "budget")}><input type="hidden" name="month" value={selectedMonth}/><label>Categoria<select name="category" required>{data.categories.filter((item) => item.macro !== "Receita").map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Valor planejado<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required/></label><button className="primary-button" type="submit"><Plus size={15}/>Salvar orçamento</button></form></article>
      <article className="panel"><PanelHeader eyebrow="ORÇADO × REALIZADO" title="Consumo por categoria"/><div className="budget-list expanded">{analytics.budgetByCategory.length ? analytics.budgetByCategory.map((item) => <div key={item.id}><div><strong>{item.category}</strong><span><CurrencyValue value={item.actual} hidden={hidden}/> de <CurrencyValue value={item.amount} hidden={hidden}/></span></div><ProgressBar value={item.usedPct} tone={item.usedPct > 100 ? "negative" : item.usedPct >= 80 ? "attention" : "positive"}/><StatusBadge tone={item.usedPct > 100 ? "negative" : item.usedPct >= 80 ? "attention" : "positive"}>{formatPercent(item.usedPct)}</StatusBadge><button className="icon-button danger" onClick={() => onDelete("budget", item.id, `Orçamento de ${item.category}`)} aria-label={`Excluir orçamento de ${item.category}`}><Trash2 size={14}/></button></div>) : <EmptyState title="Nenhum orçamento definido" description="Cadastre o primeiro limite para acompanhar o uso por categoria."/>}</div></article>
    </div>}

    {section === "contas" && <div className="planning-layout">
      <article className="panel planning-form-panel"><PanelHeader eyebrow="NOVA CONTA" title="Conta PF ou PJ"/><form className="standard-form" onSubmit={(event) => onSave(event, "account")}><label>Nome<input name="name" placeholder="Ex.: Conta principal" required/></label><label>Instituição<input name="institution" placeholder="Banco ou carteira"/></label><label>Escopo<select name="scope"><option>PF</option><option>PJ</option></select></label><label>Tipo<select name="type"><option>Conta corrente</option><option>Conta poupança</option><option>Carteira</option><option>Dinheiro</option></select></label><label>Saldo<input name="balance" type="number" step="0.01" defaultValue="0"/></label><button className="primary-button" type="submit"><Plus size={15}/>Adicionar conta</button></form></article>
      <article className="panel"><PanelHeader eyebrow="SALDOS" title="Contas cadastradas"/><div className="account-list">{nonCardAccounts.length ? nonCardAccounts.map((item) => <div key={item.id}><span><WalletCards/><strong>{item.name}<small>{item.institution || item.type} · {item.scope || "PF"}</small></strong></span><b><CurrencyValue value={item.balance} hidden={hidden}/></b><button className="icon-button danger" onClick={() => onDelete("account", item.id, item.name)} aria-label={`Excluir ${item.name}`}><Trash2 size={14}/></button></div>) : <EmptyState title="Nenhuma conta cadastrada" description="Inclua contas bancárias, carteiras e saldos para consolidar o disponível."/>}</div></article>
    </div>}

    {section === "cartoes" && <div className="planning-layout">
      <article className="panel planning-form-panel"><PanelHeader eyebrow="NOVO CARTÃO" title="Limites e vencimentos"/><form className="standard-form" onSubmit={(event) => onSave(event, "account")}><input type="hidden" name="type" value="Cartão de crédito"/><input type="hidden" name="balance" value="0"/><label>Nome do cartão<input name="name" placeholder="Ex.: Visa principal" required/></label><label>Instituição<input name="institution" placeholder="Banco emissor"/></label><label>Escopo<select name="scope"><option>PF</option><option>PJ</option></select></label><label>Limite total<input name="creditLimit" type="number" min="0" step="0.01" required/></label><label>Dia do fechamento<input name="closingDay" type="number" min="1" max="31" required/></label><label>Dia do vencimento<input name="dueDay" type="number" min="1" max="31" required/></label><button className="primary-button" type="submit"><Plus size={15}/>Adicionar cartão</button></form></article>
      <article className="panel"><PanelHeader eyebrow="UTILIZAÇÃO" title="Cartões de crédito"/><div className="credit-card-list">{cards.length ? cards.map((card) => {
        const used = data.transactions.filter((item) => item.type === "saida" && item.account === card.name && item.date.startsWith(selectedMonth)).reduce((sum, item) => sum + item.value, 0);
        const usedPct = card.creditLimit ? used / card.creditLimit * 100 : 0;
        return <div className="credit-card-item" key={card.id}><div><span><CreditCard/><strong>{card.name}<small>{card.institution || "Instituição não informada"}</small></strong></span><button className="icon-button danger" onClick={() => onDelete("account", card.id, card.name)} aria-label={`Excluir ${card.name}`}><Trash2 size={14}/></button></div><dl><div><dt>Limite total</dt><dd><CurrencyValue value={card.creditLimit} hidden={hidden}/></dd></div><div><dt>Utilizado no mês</dt><dd><CurrencyValue value={used} hidden={hidden}/></dd></div><div><dt>Disponível</dt><dd><CurrencyValue value={Math.max(0, card.creditLimit - used)} hidden={hidden}/></dd></div></dl><ProgressBar value={usedPct} tone={usedPct > 80 ? "negative" : usedPct >= 50 ? "attention" : "positive"} label="Utilização do limite"/><footer>Fecha dia {card.closingDay || "—"} · vence dia {card.dueDay || "—"}<small>Faixas apenas visuais: até 50%, 50–80% e acima de 80%.</small></footer></div>;
      }) : <EmptyState title="Nenhum cartão cadastrado" description="Cadastre limites, fechamento e vencimento para acompanhar o comprometimento mensal."/>}</div></article>
    </div>}

    {section === "metas" && <div className="planning-layout">
      <article className="panel planning-form-panel"><PanelHeader eyebrow="NOVA META" title="Objetivo financeiro"/><form className="standard-form" onSubmit={(event) => onSave(event, "goal")}><label>Nome<input name="name" placeholder="Ex.: Reserva de 12 meses" required/></label><label>Valor alvo<input name="target" type="number" min="0.01" step="0.01" required/></label><label>Acumulado<input name="current" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Prazo<input name="deadline" type="date" required/></label><button className="primary-button" type="submit"><Plus size={15}/>Adicionar meta</button></form></article>
      <article className="panel"><PanelHeader eyebrow="PROGRESSO" title="Metas financeiras"/><div className="goal-list">{goalRows.length ? goalRows.map((goal) => <article key={goal.id}><header><span><Target/><strong>{goal.name}<small>Prazo: {formatDate(goal.deadline)}</small></strong></span><button className="icon-button danger" onClick={() => onDelete("goal", goal.id, goal.name)} aria-label={`Excluir ${goal.name}`}><Trash2 size={14}/></button></header><div><span>Acumulado<strong><CurrencyValue value={goal.current} hidden={hidden}/></strong></span><span>Faltante<strong><CurrencyValue value={goal.missing} hidden={hidden}/></strong></span><span>Meses restantes<strong>{goal.monthsRemaining}</strong></span></div><ProgressBar value={goal.target ? goal.current / goal.target * 100 : 0} label="Progresso"/><p>Para atingir esta meta, o aporte matemático aproximado seria de <strong><CurrencyValue value={goal.monthlySuggestion} hidden={hidden}/></strong> por mês.</p></article>) : <EmptyState title="Nenhuma meta cadastrada" description="Crie objetivos com valor e prazo para calcular o aporte mensal necessário."/>}</div></article>
    </div>}

    {section === "recorrencias" && <article className="panel full-module-panel"><PanelHeader eyebrow="COMPROMISSOS AUTOMÁTICOS" title="Despesas recorrentes"/><div className="recurrence-list">{recurringTransactions.length || analytics.activeSubscriptions.length ? <>{recurringTransactions.map((item) => <div key={`t-${item.id}`}><Repeat2/><span><strong>{item.description}</strong><small>{item.category} · {item.recurrence}</small></span><CurrencyValue value={item.value} hidden={hidden}/></div>)}{analytics.activeSubscriptions.map((item) => <div key={`s-${item.id}`}><Repeat2/><span><strong>{item.name}</strong><small>{item.category} · assinatura · dia {item.billingDay}</small></span><CurrencyValue value={item.value} hidden={hidden}/></div>)}</> : <EmptyState title="Nenhuma recorrência cadastrada" description="Marque lançamentos como mensais ou cadastre assinaturas para formar esta visão." icon={Repeat2}/>}</div></article>}

    {section === "parcelamentos" && <article className="panel full-module-panel"><PanelHeader eyebrow="COMPROMISSOS FUTUROS" title="Parcelas já lançadas"/><div className="future-table">{analytics.futureInstallments.length ? analytics.futureInstallments.map((item) => <div key={item.id}><CalendarClock/><span><strong>{item.description}</strong><small>{formatDate(item.date)} · {item.account || "Conta não informada"}</small></span><StatusBadge tone="attention">{item.installmentCurrent}/{item.installmentTotal}</StatusBadge><CurrencyValue value={item.value} hidden={hidden}/></div>) : <EmptyState title="Nenhum parcelamento futuro" description="Compras parceladas aparecem aqui sem duplicar valores além das parcelas criadas." icon={CalendarClock}/>}</div></article>}
  </section>;
}
