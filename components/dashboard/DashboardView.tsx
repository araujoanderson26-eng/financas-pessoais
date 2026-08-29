"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import type { FinanceData, Tab } from "@/lib/finance/types";
import { formatCurrency, formatDate, formatMonth, formatPercent } from "@/lib/formatters";
import { CurrencyValue, EmptyState, KpiCard, PanelHeader, ProgressBar, SectionHeader, StatusBadge, TrendIndicator } from "@/components/shared";

type Analytics = ReturnType<typeof getFinancialAnalytics>;

const chartColors = ["#1f6b52", "#d9a441", "#426c8f", "#8b6f61", "#6f9385", "#7f7894"];

export function DashboardView({
  data,
  analytics,
  selectedMonth,
  setSelectedMonth,
  hidden,
  onNavigate,
  onNewTransaction,
}: {
  data: FinanceData;
  analytics: Analytics;
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  hidden: boolean;
  onNavigate: (tab: Tab) => void;
  onNewTransaction: () => void;
}) {
  const [trendWindow, setTrendWindow] = useState<3 | 6 | 12>(12);
  const balanceDelta = analytics.previous.count ? analytics.totals.balance - analytics.previous.balance : null;
  const reserveProgress = analytics.reserveTarget ? analytics.emergencyReserve / analytics.reserveTarget * 100 : 0;
  const snapshotData = data.snapshots.map((item) => ({ date: formatDate(item.snapshotDate), patrimonio: item.netWorth }));
  const annual = useMemo(() => {
    const months = analytics.monthlyTrend;
    const income = months.reduce((sum, item) => sum + item.entradas, 0);
    const expenses = months.reduce((sum, item) => sum + item.saidas, 0);
    const active = months.filter((item) => item.entradas || item.saidas);
    const best = active.length ? active.reduce((current, item) => item.saldo > current.saldo ? item : current) : null;
    const worst = active.length ? active.reduce((current, item) => item.saldo < current.saldo ? item : current) : null;
    return { income, expenses, balance: income - expenses, averageSavings: income ? ((income - expenses) / income) * 100 : 0, best, worst };
  }, [analytics.monthlyTrend]);
  const commitments = [
    ...analytics.futureInstallments.slice(0, 5).map((item) => ({ id: `installment-${item.id}`, date: item.date, title: item.description, meta: `${item.account || "Conta não informada"} · Parcela ${item.installmentCurrent || 1}/${item.installmentTotal || 1}`, value: item.value, tone: "attention" as const })),
    ...analytics.activeSubscriptions.slice(0, 5).map((item) => ({ id: `subscription-${item.id}`, date: `${selectedMonth}-${String(Math.min(item.billingDay, 28)).padStart(2, "0")}`, title: item.name, meta: `${item.category} · Assinatura mensal`, value: item.value, tone: "neutral" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  const tooltipValue = (value: number) => hidden ? "R$ ••••••" : formatCurrency(value);

  return <section className="dashboard-page">
    <SectionHeader
      eyebrow="VISÃO GERAL"
      title="Seu patrimônio, com clareza."
      description="Uma leitura executiva do caixa, patrimônio, compromissos e decisões do período."
      actions={<label className="month-control"><span>Período</span><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Período do dashboard" /></label>}
    />

    <div className="kpi-grid kpi-grid-primary">
      <KpiCard label="Patrimônio líquido" value={analytics.netWorth} helper="Ativos menos obrigações" icon={Landmark} tone="positive" hidden={hidden} />
      <KpiCard label="Saldo disponível" value={analytics.accountBalance} helper="Contas sem cartões" icon={WalletCards} tone="info" hidden={hidden} />
      <KpiCard label="Investimentos" value={analytics.portfolioTotal} helper={`${formatPercent(analytics.averageReturn)} de rentabilidade média informada`} icon={TrendingUp} tone="neutral" hidden={hidden} />
      <KpiCard label="Reserva de emergência" value={analytics.emergencyReserve} helper={analytics.totals.fixed ? `${analytics.reserveMonths.toFixed(1)} meses de gastos fixos` : "Aguardando gastos fixos no período"} icon={ShieldCheck} tone="attention" hidden={hidden} />
      <KpiCard label="Dívidas" value={analytics.liabilities} helper="Financiamentos e obrigações" icon={ArrowDownRight} tone="negative" hidden={hidden} />
      <KpiCard label="Saldo do mês" value={analytics.totals.balance} helper={`${formatPercent(analytics.totals.savingsRate)} de taxa de poupança`} icon={PiggyBank} tone={analytics.totals.balance >= 0 ? "positive" : "negative"} trend={balanceDelta} hidden={hidden} />
    </div>

    <div className="decision-grid">
      <article className="health-score-card">
        <div className="health-score-ring" style={{ "--score": analytics.healthScore } as React.CSSProperties}><strong>{analytics.healthScore}</strong><small>/100</small></div>
        <div><span>SAÚDE FINANCEIRA</span><h2>{analytics.healthLabel}</h2><p>Indicador interno do Nexo, calculado somente com os fatores que possuem dados suficientes.</p>
          <details className="score-details"><summary>Como o score é formado</summary><div>{analytics.healthFactors.map((factor) => <p key={factor.label}><span>{factor.label}<small>{factor.detail}</small></span><strong>{Math.round(factor.value * 100)}%</strong></p>)}</div><small>Este indicador não é uma avaliação financeira oficial.</small></details>
        </div>
      </article>
      <article className="reserve-card">
        <div className="reserve-card-head"><div><span>RESERVA DE EMERGÊNCIA</span><h2>Cobertura de {analytics.reserveMonths.toFixed(1)} meses</h2></div><ShieldCheck /></div>
        <div className="reserve-values"><span>Reserva atual<strong><CurrencyValue value={analytics.emergencyReserve} hidden={hidden} /></strong></span><span>Meta de 6 meses<strong><CurrencyValue value={analytics.reserveTarget} hidden={hidden} /></strong></span></div>
        <ProgressBar value={reserveProgress} tone={reserveProgress >= 100 ? "positive" : reserveProgress >= 60 ? "attention" : "negative"} label="Progresso" />
        <p>{analytics.reserveTarget ? analytics.emergencyReserve >= analytics.reserveTarget ? "A meta de seis meses está coberta pelos investimentos identificados como reserva." : <>Faltam <strong><CurrencyValue value={Math.max(0, analytics.reserveTarget - analytics.emergencyReserve)} hidden={hidden} /></strong> para atingir seis meses de gastos fixos.</> : "Registre gastos fixos para o Nexo calcular uma meta de cobertura."}</p>
      </article>
      <article className={`projection-card ${analytics.projectedBalance < 0 ? "negative" : ""}`}>
        <div><span>PROJEÇÃO DO MÊS</span><CalendarClock /></div><h2><CurrencyValue value={analytics.projectedBalance} hidden={hidden} /></h2><p>{analytics.daysRemaining ? `Mantido o ritmo registrado, ${formatMonth(selectedMonth)} pode fechar com este saldo.` : "Período encerrado: a projeção coincide com o realizado registrado."}</p>
        <dl><div><dt>Receita registrada</dt><dd><CurrencyValue value={analytics.totals.income} hidden={hidden} /></dd></div><div><dt>Despesas projetadas</dt><dd><CurrencyValue value={analytics.projectedExpenses} hidden={hidden} /></dd></div><div><dt>Dias restantes</dt><dd>{analytics.daysRemaining}</dd></div></dl>
        <small>Projeção baseada exclusivamente no ritmo dos lançamentos registrados.</small>
      </article>
    </div>

    {analytics.alerts.length > 0 && <section className="alert-center"><div className="alert-center-title"><AlertCircle /><span><strong>Alertas financeiros</strong><small>Leituras contextuais, sem alarmismo.</small></span></div><div>{analytics.alerts.slice(0, 3).map((alert) => <article key={alert.title}><StatusBadge tone={alert.level === "important" ? "negative" : alert.level === "attention" ? "attention" : "info"}>{alert.level === "important" ? "Importante" : alert.level === "attention" ? "Atenção" : "Informação"}</StatusBadge><strong>{alert.title}</strong><p>{alert.text}</p></article>)}</div></section>}

    <div className="dashboard-chart-grid">
      <article className="panel cashflow-panel"><PanelHeader eyebrow="FLUXO DE CAIXA" title="Receitas, despesas e saldo" action={<div className="segmented">{([3, 6, 12] as const).map((period) => <button key={period} className={trendWindow === period ? "active" : ""} onClick={() => setTrendWindow(period)}>{period === 3 ? "3 meses" : period === 6 ? "6 meses" : "12 meses"}</button>)}</div>} />
        {analytics.monthlyTrend.some((item) => item.entradas || item.saidas) ? <div className="chart chart-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={analytics.monthlyTrend.slice(-trendWindow)} margin={{ top: 20, right: 12, left: -5, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} width={64} tickFormatter={(value) => `${value / 1000}k`}/><Tooltip formatter={(value) => tooltipValue(Number(value))} contentStyle={{ borderRadius: 10, borderColor: "var(--line)" }}/><Bar dataKey="entradas" name="Receitas" fill="#1f6b52" radius={[5,5,0,0]} maxBarSize={26}/><Bar dataKey="saidas" name="Despesas" fill="#b75f51" radius={[5,5,0,0]} maxBarSize={26}/><Line dataKey="saldo" name="Saldo" stroke="#d9a441" strokeWidth={2.5} dot={{ r: 3 }}/></ComposedChart></ResponsiveContainer></div> : <EmptyState title="Fluxo de caixa em formação" description="Registre entradas e saídas para visualizar a evolução mensal sem dados simulados." action={<button className="text-button" onClick={onNewTransaction}>Adicionar lançamento <ArrowRight size={15}/></button>} />}
      </article>
      <article className="panel networth-panel"><PanelHeader eyebrow="PATRIMÔNIO" title="Evolução do patrimônio líquido" />
        {snapshotData.length >= 2 ? <div className="chart chart-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={snapshotData}><defs><linearGradient id="networth-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f6b52" stopOpacity=".28"/><stop offset="100%" stopColor="#1f6b52" stopOpacity="0"/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)"/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`}/><Tooltip formatter={(value) => tooltipValue(Number(value))}/><Area dataKey="patrimonio" name="Patrimônio líquido" stroke="#1f6b52" fill="url(#networth-gradient)" strokeWidth={2.5}/></AreaChart></ResponsiveContainer></div> : <EmptyState title="Histórico patrimonial iniciado" description="O Nexo passou a registrar snapshots reais. O gráfico surgirá após haver pelo menos dois dias de histórico." icon={Landmark} />}
      </article>
    </div>

    <div className="dashboard-detail-grid">
      <article className="panel category-panel"><PanelHeader eyebrow="DESPESAS" title="Principais categorias" action={<button className="text-button" onClick={() => onNavigate("movimentos")}>Ver todas <ArrowRight size={14}/></button>} />
        {analytics.categories.length ? <><div className="chart chart-medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.categories.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 25 }}><XAxis type="number" hide/><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={88}/><Tooltip formatter={(value) => tooltipValue(Number(value))}/><Bar dataKey="value" name="Despesas" radius={[0,7,7,0]}>{analytics.categories.slice(0, 6).map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="category-comparison">{analytics.categories.slice(0, 5).map((item) => <div key={item.name}><span><i style={{ background: chartColors[analytics.categories.indexOf(item) % chartColors.length] }}/><strong>{item.name}</strong><small>{formatPercent(item.percent)} das despesas</small></span><span><CurrencyValue value={item.value} hidden={hidden}/><TrendIndicator value={item.change} inverse /></span></div>)}</div></> : <EmptyState compact title="Sem despesas no período" description="As categorias aparecerão conforme as saídas forem registradas." />}
      </article>
      <article className="panel budget-panel"><PanelHeader eyebrow="PLANEJAMENTO" title="Orçado × realizado" action={<button className="text-button" onClick={() => onNavigate("planejamento")}>Planejar <ArrowRight size={14}/></button>} />
        {analytics.budgetByCategory.length ? <div className="budget-list">{analytics.budgetByCategory.slice(0, 7).map((item) => <div key={item.id}><div><strong>{item.category}</strong><span><CurrencyValue value={item.actual} hidden={hidden}/> de <CurrencyValue value={item.amount} hidden={hidden}/></span></div><ProgressBar value={item.usedPct} tone={item.usedPct > 100 ? "negative" : item.usedPct >= 80 ? "attention" : "positive"}/><StatusBadge tone={item.usedPct > 100 ? "negative" : item.usedPct >= 80 ? "attention" : "positive"}>{formatPercent(item.usedPct)} usado</StatusBadge></div>)}</div> : <EmptyState title="Nenhum orçamento para este mês" description="Defina limites por categoria para comparar o planejado com o realizado." action={<button className="text-button" onClick={() => onNavigate("planejamento")}>Criar orçamento <ArrowRight size={15}/></button>} icon={PiggyBank}/>} 
      </article>
      <article className="panel commitments-panel"><PanelHeader eyebrow="AGENDA FINANCEIRA" title="Próximos compromissos" action={<button className="text-button" onClick={() => onNavigate("assinaturas")}>Ver agenda <ArrowRight size={14}/></button>} />
        {commitments.length ? <div className="commitment-list">{commitments.map((item) => <div key={item.id}><span className="commitment-date">{formatDate(item.date).slice(0,5)}</span><span><strong>{item.title}</strong><small>{item.meta}</small></span><CurrencyValue value={item.value} hidden={hidden}/></div>)}</div> : <EmptyState compact title="Agenda sem compromissos" description="Parcelas e assinaturas futuras aparecerão aqui em ordem de data." icon={CalendarClock}/>} 
      </article>
    </div>

    <section className="annual-overview">
      <div><span>VISÃO ANUAL</span><h2>Acumulado dos últimos 12 meses</h2><p>Somente meses com dados registrados entram nos destaques.</p></div>
      <dl><div><dt>Receitas</dt><dd><CurrencyValue value={annual.income} hidden={hidden}/></dd></div><div><dt>Despesas</dt><dd><CurrencyValue value={annual.expenses} hidden={hidden}/></dd></div><div><dt>Saldo</dt><dd><CurrencyValue value={annual.balance} hidden={hidden}/></dd></div><div><dt>Poupança média</dt><dd>{formatPercent(annual.averageSavings)}</dd></div><div><dt>Melhor mês</dt><dd>{annual.best?.month || "—"}</dd></div><div><dt>Mês mais desafiador</dt><dd>{annual.worst?.month || "—"}</dd></div></dl>
    </section>

    <section className="nexo-insights"><div><Sparkles/><span><small>INSIGHTS DO NEXO</small><h2>Leituras automáticas do período</h2></span></div>{analytics.insights.length ? <div>{analytics.insights.slice(0, 4).map((item) => <p key={item}>{item}</p>)}</div> : <p>O Nexo exibirá comparações quando houver dados suficientes em dois períodos.</p>}<button onClick={() => onNavigate("consultor")}>Explorar com o Consultor IA <ArrowUpRight size={16}/></button></section>
  </section>;
}
