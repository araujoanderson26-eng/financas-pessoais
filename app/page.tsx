"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  Bell,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  Menu,
  FileDown,
  FileText,
  Landmark,
  Plus,
  PiggyBank,
  Repeat2,
  Send,
  Settings,
  Sparkles,
  Tags,
  Target,
  Pencil,
  Trash2,
  TrendingUp,
  WalletCards,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Tab = "dashboard" | "movimentos" | "planejamento" | "patrimonio" | "categorias" | "investimentos" | "assinaturas" | "relatorio" | "historico" | "consultor";
type Transaction = {
  id: number;
  date: string;
  description: string;
  category: string;
  macro: "Fixo" | "Variável" | "Receita";
  type: "entrada" | "saida";
  value: number;
  account?: string;
  recurrence?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
};
type Category = { id?: number; name: string; macro: string };
type Investment = { id?: number; name: string; type: string; value: number; returnPct: number };
type Account = { id: number; name: string; type: string; balance: number; creditLimit: number; scope?: string; institution?: string; closingDay?: number; dueDay?: number };
type Budget = { id: number; month: string; category: string; amount: number };
type Goal = { id: number; name: string; target: number; current: number; deadline: string };
type WealthItem = { id: number; name: string; kind: "Ativo" | "Passivo"; group: string; value: number; remainingDebt: number };
type Subscription = { id: number; name: string; category: string; account: string; value: number; billingDay: number; status: "Ativa" | "Inativa" };
type AuditEvent = { id: number; transactionId: number; action: string; snapshot: string; createdAt: string };
type ReportNote = { id: number; month: string; note: string; updatedAt: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

const nav = [
  { id: "dashboard" as Tab, label: "Visão geral", icon: LayoutDashboard },
  { id: "movimentos" as Tab, label: "Movimentações", icon: CreditCard },
  { id: "planejamento" as Tab, label: "Planejamento", icon: PiggyBank },
  { id: "patrimonio" as Tab, label: "Patrimônio", icon: Landmark },
  { id: "categorias" as Tab, label: "Categorias", icon: Tags },
  { id: "investimentos" as Tab, label: "Investimentos", icon: TrendingUp },
  { id: "assinaturas" as Tab, label: "Assinaturas", icon: Repeat2 },
  { id: "relatorio" as Tab, label: "Relatório mensal", icon: FileText },
  { id: "historico" as Tab, label: "Histórico e backup", icon: FileDown },
  { id: "consultor" as Tab, label: "Consultor IA", icon: Sparkles },
];

function Kpi({ label, value, helper, tone, icon: Icon }: { label: string; value: string; helper: string; tone: string; icon: typeof WalletCards }) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon ${tone}`}><Icon size={19} /></div>
      <div className="kpi-copy"><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>
    </article>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="empty-hint">{children}</div>;
}

export default function Home() {
  const [active, setActive] = useState<Tab>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { name: "Salário", macro: "Receita" }, { name: "Renda de imóvel", macro: "Receita" },
    { name: "Moradia", macro: "Fixo" }, { name: "Transporte", macro: "Fixo" },
    { name: "Saúde", macro: "Fixo" }, { name: "Educação", macro: "Fixo" },
    { name: "Alimentação", macro: "Variável" }, { name: "Lazer", macro: "Variável" }, { name: "Compras", macro: "Variável" },
  ]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [wealthItems, setWealthItems] = useState<WealthItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [reportNotes, setReportNotes] = useState<ReportNote[]>([]);
  const [editingWealth, setEditingWealth] = useState<WealthItem | null>(null);
  const [modal, setModal] = useState<"transaction" | "category" | "investment" | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ entity: "transaction" | "investment"; id: number; label: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chat, setChat] = useState([{ role: "ai", text: "Posso analisar os lançamentos do período escolhido, sua reserva e seus investimentos. O que você quer avaliar?" }]);
  const [question, setQuestion] = useState("");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "local">("loading");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedInvestmentType, setSelectedInvestmentType] = useState("all");
  const [trendWindow, setTrendWindow] = useState<3 | 6 | 12>(12);
  const [reportNote, setReportNote] = useState("");

  useEffect(() => {
    fetch("/api/finance")
      .then(async response => {
        if (!response.ok) throw new Error("database unavailable");
        return response.json();
      })
      .then(data => {
        if (data.categories?.length) setCategories(data.categories);
        setTransactions(data.transactions || []);
        setInvestments(data.investments || []);
        setAccounts(data.accounts || []);
        setBudgets(data.budgets || []);
        setGoals(data.goals || []);
        setWealthItems(data.wealthItems || []);
        setSubscriptions(data.subscriptions || []);
        setAuditEvents(data.auditEvents || []);
        setReportNotes(data.reportNotes || []);
        setSyncState("saved");
      })
      .catch(() => setSyncState("local"));
  }, []);

  useEffect(() => {
    setReportNote(reportNotes.find(item => item.month === selectedMonth)?.note || "");
  }, [selectedMonth, reportNotes]);

  const filteredTransactions = useMemo(() => transactions.filter(transaction => {
    if (!transaction.date.startsWith(selectedMonth)) return false;
    if (selectedDay !== "all" && Number(transaction.date.slice(8, 10)) !== Number(selectedDay)) return false;
    if (selectedCategory !== "all" && transaction.category !== selectedCategory) return false;
    if (selectedAccount !== "all" && transaction.account !== selectedAccount) return false;
    return true;
  }), [transactions, selectedMonth, selectedDay, selectedCategory, selectedAccount]);

  const daysInSelectedMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();
  const periodLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T12:00:00`));

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === "entrada").reduce((s, t) => s + t.value, 0);
    const expenses = filteredTransactions.filter(t => t.type === "saida").reduce((s, t) => s + t.value, 0);
    const fixed = filteredTransactions.filter(t => t.type === "saida" && t.macro === "Fixo").reduce((s, t) => s + t.value, 0);
    const variable = expenses - fixed;
    return { income, expenses, fixed, variable, balance: income - expenses, savingsRate: income ? ((income - expenses) / income) * 100 : 0 };
  }, [filteredTransactions]);

  const spendByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.filter(t => t.type === "saida").forEach(t => map.set(t.category, (map.get(t.category) || 0) + t.value));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filteredTransactions]);

  const monthlyTrend = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const base = new Date(`${selectedMonth}-01T12:00:00`);
    base.setMonth(base.getMonth() - (11 - index));
    const key = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
    const rows = transactions.filter(item => item.date.startsWith(key));
    return {
      key,
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(base).replace(".", ""),
      entradas: rows.filter(item => item.type === "entrada").reduce((sum, item) => sum + item.value, 0),
      saidas: rows.filter(item => item.type === "saida").reduce((sum, item) => sum + item.value, 0),
    };
  }), [transactions, selectedMonth]);

  const previousMonth = useMemo(() => {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() - 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const rows = transactions.filter(item => item.date.startsWith(key));
    const income = rows.filter(item => item.type === "entrada").reduce((sum, item) => sum + item.value, 0);
    const expenses = rows.filter(item => item.type === "saida").reduce((sum, item) => sum + item.value, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions, selectedMonth]);

  const colors = ["#1f6b52", "#d9a441", "#426c8f", "#9d684f", "#72a08e", "#7c6f9b"];
  const portfolioTotal = investments.reduce((s, i) => s + i.value, 0);
  const filteredInvestments = selectedInvestmentType === "all" ? investments : investments.filter(item => item.type === selectedInvestmentType);
  const averageReturn = portfolioTotal ? investments.reduce((sum, item) => sum + item.returnPct * item.value, 0) / portfolioTotal : 0;
  const featuredGoal = goals[0];
  const budgetTotal = budgets.filter(item => item.month === selectedMonth).reduce((sum, item) => sum + item.amount, 0);
  const assetTotal = wealthItems.filter(item => item.kind === "Ativo").reduce((sum, item) => sum + item.value, 0) + portfolioTotal + accounts.reduce((sum, item) => sum + item.balance, 0);
  const liabilityTotal = wealthItems.reduce((sum, item) => sum + (item.kind === "Passivo" ? item.value : Number(item.remainingDebt || 0)), 0);
  const netWorth = assetTotal - liabilityTotal;
  const accountBalance = accounts.filter(item => item.type !== "Cartão de crédito").reduce((sum, item) => sum + item.balance, 0);
  const emergencyReserve = investments.filter(item => /reserva|liquidez|tesouro selic|cdb/i.test(`${item.name} ${item.type}`)).reduce((sum, item) => sum + item.value, 0);
  const activeSubscriptions = subscriptions.filter(item => item.status === "Ativa");
  const subscriptionMonthly = activeSubscriptions.reduce((sum, item) => sum + item.value, 0);
  const recurringCommitment = filteredTransactions.filter(item => item.type === "saida" && item.recurrence === "Mensal").reduce((sum, item) => sum + item.value, 0) + subscriptionMonthly;
  const futureInstallments = transactions.filter(item => item.type === "saida" && Number(item.installmentTotal || 1) > 1 && item.date > `${selectedMonth}-31`);
  const futureInstallmentTotal = futureInstallments.reduce((sum, item) => sum + item.value, 0);
  const elapsedDays = selectedMonth === currentMonth ? Number(today.slice(8, 10)) : daysInSelectedMonth;
  const projectedExpenses = elapsedDays ? (totals.expenses / elapsedDays) * daysInSelectedMonth : 0;
  const alerts = [
    ...(budgetTotal && totals.expenses > budgetTotal ? [`Orçamento excedido em ${money.format(totals.expenses - budgetTotal)}.`] : []),
    ...(totals.income && totals.fixed / totals.income > .6 ? ["Gastos fixos acima de 60% da renda."] : []),
    ...(projectedExpenses > totals.income && totals.income ? ["No ritmo atual, o mês pode fechar negativo."] : []),
    ...(!goals.length ? ["Cadastre uma meta financeira para direcionar seus aportes."] : []),
  ];
  const expenseDelta = previousMonth.expenses ? ((totals.expenses - previousMonth.expenses) / previousMonth.expenses) * 100 : 0;
  const balanceDelta = totals.balance - previousMonth.balance;
  const reportRecommendations = [
    totals.savingsRate < 10 ? "Defina um aporte automático logo após o recebimento para elevar a taxa de poupança." : "Mantenha o ritmo de poupança e direcione o saldo positivo para as metas prioritárias.",
    totals.income && totals.fixed / totals.income > .6 ? "Revise contratos e compromissos fixos: eles consomem mais de 60% da renda do mês." : "Os gastos fixos estão em uma faixa administrável em relação à renda registrada.",
    emergencyReserve < totals.fixed * 6 ? `Priorize a reserva de emergência; faltam ${money.format(Math.max(0, totals.fixed * 6 - emergencyReserve))} para cobrir seis meses de gastos fixos.` : "A reserva registrada cobre pelo menos seis meses dos gastos fixos deste período.",
  ];
  const auditRows = useMemo(() => auditEvents.map(event => {
    try {
      const parsed = JSON.parse(event.snapshot) as Record<string, unknown>;
      const item = (parsed.after && typeof parsed.after === "object" ? parsed.after : parsed) as Record<string, unknown>;
      return { ...event, description: String(item.description || "Lançamento"), value: Number(item.value || 0) };
    } catch {
      return { ...event, description: "Lançamento", value: 0 };
    }
  }), [auditEvents]);

  function openNewTransaction() {
    setEditingTransaction(null);
    setModal("transaction");
  }

  function openNewInvestment() {
    setEditingInvestment(null);
    setModal("investment");
  }

  async function sendFinanceAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("Falha ao salvar");
    return response.json();
  }

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get("type")) as "entrada" | "saida";
    const category = String(form.get("category"));
    const selected = categories.find(c => c.name === category);
    const item = { id: editingTransaction?.id || Date.now(), date: String(form.get("date")), description: String(form.get("description")), category, macro: (selected?.macro || "Variável") as Transaction["macro"], type, value: Number(form.get("value")), account: String(form.get("account") || "Não informado"), recurrence: String(form.get("recurrence") || "Não"), installmentCurrent: editingTransaction?.installmentCurrent || 1, installmentTotal: Number(form.get("installmentTotal") || editingTransaction?.installmentTotal || 1) };
    if (editingTransaction) setTransactions(prev => prev.map(current => current.id === item.id ? item : current));
    else setTransactions(prev => [item, ...prev]);
    setModal(null);
    setEditingTransaction(null);
    try {
      const data = await sendFinanceAction({ action: editingTransaction ? "update_transaction" : "transaction", ...item });
      if (!editingTransaction && data.items?.length) setTransactions(prev => [...data.items, ...prev.filter(current => current.id !== item.id)]);
      else if (!editingTransaction && data.item?.id) setTransactions(prev => prev.map(current => current.id === item.id ? data.item : current));
      setSyncState("saved");
    } catch { setSyncState("local"); }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = { name: String(form.get("name")), macro: String(form.get("macro")) };
    setCategories(prev => [...prev, item]);
    setModal(null);
    try { const response = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "category", ...item }) }); if (!response.ok) throw new Error(); setSyncState("saved"); } catch { setSyncState("local"); }
  }

  async function addInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = { id: editingInvestment?.id || Date.now(), name: String(form.get("name")), type: String(form.get("type")), value: Number(form.get("value")), returnPct: Number(form.get("return")) };
    if (editingInvestment) setInvestments(prev => prev.map(current => current.id === item.id ? item : current));
    else setInvestments(prev => [...prev, item]);
    setModal(null);
    setEditingInvestment(null);
    try {
      const data = await sendFinanceAction({ action: editingInvestment ? "update_investment" : "investment", ...item });
      if (!editingInvestment && data.item?.id) setInvestments(prev => prev.map(current => current.id === item.id ? data.item : current));
      setSyncState("saved");
    } catch { setSyncState("local"); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await sendFinanceAction({ action: deleteTarget.entity === "transaction" ? "delete_transaction" : "delete_investment", id: deleteTarget.id });
      if (deleteTarget.entity === "transaction") setTransactions(prev => prev.filter(item => item.id !== deleteTarget.id));
      else setInvestments(prev => prev.filter(item => item.id !== deleteTarget.id));
      if (deleteTarget.entity === "transaction") {
        const refreshed = await fetch("/api/finance").then(response => response.json());
        setAuditEvents(refreshed.auditEvents || []);
      }
      setSyncState("saved");
      setDeleteTarget(null);
    } catch { setSyncState("local"); }
  }

  async function savePlanning(event: FormEvent<HTMLFormElement>, kind: "account" | "budget" | "goal" | "wealth") {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const data = await sendFinanceAction({ action: `save_${kind}`, ...values });
    if (kind === "account") setAccounts(prev => [...prev, data.item]);
    if (kind === "budget") setBudgets(prev => [...prev.filter(item => !(item.month === data.item.month && item.category === data.item.category)), data.item]);
    if (kind === "goal") setGoals(prev => [...prev, data.item]);
    if (kind === "wealth") setWealthItems(prev => [...prev, data.item]);
    event.currentTarget.reset();
  }

  async function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const data = await sendFinanceAction({ action: "save_subscription", ...values });
    setSubscriptions(prev => [...prev, data.item]);
    event.currentTarget.reset();
    setSyncState("saved");
  }

  async function archiveSubscription(id: number) {
    const data = await sendFinanceAction({ action: "archive_subscription", id });
    setSubscriptions(prev => prev.map(item => item.id === id ? data.item : item));
    setSyncState("saved");
  }

  async function saveReportNote() {
    const data = await sendFinanceAction({ action: "save_report_note", month: selectedMonth, note: reportNote });
    setReportNotes(prev => [data.item, ...prev.filter(item => item.month !== selectedMonth)]);
    setSyncState("saved");
  }

  function downloadBackup() {
    const link = document.createElement("a");
    link.href = "/api/backup";
    link.download = `nexo-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function saveWealth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const data = await sendFinanceAction({ action: editingWealth ? "update_wealth" : "save_wealth", id: editingWealth?.id, ...values });
    if (editingWealth) setWealthItems(prev => prev.map(item => item.id === editingWealth.id ? data.item : item));
    else setWealthItems(prev => [...prev, data.item]);
    setEditingWealth(null);
    event.currentTarget.reset();
    setSyncState("saved");
  }

  async function deletePlanning(entity: "account" | "budget" | "goal" | "wealth", id: number) {
    await sendFinanceAction({ action: "delete_planning", entity, id });
    if (entity === "account") setAccounts(prev => prev.filter(item => item.id !== id));
    if (entity === "budget") setBudgets(prev => prev.filter(item => item.id !== id));
    if (entity === "goal") setGoals(prev => prev.filter(item => item.id !== id));
    if (entity === "wealth") { setWealthItems(prev => prev.filter(item => item.id !== id)); if (editingWealth?.id === id) setEditingWealth(null); }
  }

  function exportCsv() {
    const header = "data,descricao,categoria,natureza,tipo,valor,conta,recorrencia";
    const lines = transactions.map(item => [item.date, item.description, item.category, item.macro, item.type, item.value, item.account || "", item.recurrence || "Não"].map(value => `"${String(value).replaceAll('"', '""')}"`).join(","));
    const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `nexo-financas-${selectedMonth}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function importCsv(file?: File) {
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
      const values = line.split(",").map(value => value.replace(/^"|"$/g, "").replaceAll('""', '"'));
      return { date: values[0], description: values[1], category: values[2], macro: values[3] || "Variável", type: values[4] || "saida", value: Number(String(values[5]).replace(",", ".")), account: values[6] || "Não informado", recurrence: values[7] || "Não" };
    }).filter(row => row.date && row.description && Number.isFinite(row.value));
    await sendFinanceAction({ action: "bulk_import", rows });
    const response = await fetch("/api/finance"); const data = await response.json(); setTransactions(data.transactions || []);
  }

  async function askAdvisor(event: FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (!q) return;
    setChat(prev => [...prev, { role: "user", text: q }]);
    setQuestion("");
    try {
      const response = await fetch("/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, summary: { ...totals, portfolioTotal, reserve: investments.find(i => i.name.toLowerCase().includes("reserva"))?.value || 0, budgetTotal, projectedExpenses, netWorth, recurringCommitment, alerts } }) });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setChat(prev => [...prev, { role: "ai", text: data.answer }]);
    } catch { setChat(prev => [...prev, { role: "ai", text: "Não consegui concluir a análise agora. Tente novamente em instantes." }]); }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><CircleDollarSign size={23} /></div><div><strong>Nexo</strong><span>Finanças pessoais</span></div></div>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
        <nav>
          <p>CONTROLE</p>
          {nav.slice(0, 9).map(item => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => { setActive(item.id); setMenuOpen(false); }}><item.icon size={18} />{item.label}</button>)}
          <p>INTELIGÊNCIA</p>
          <button className={active === "consultor" ? "active ai-nav" : "ai-nav"} onClick={() => { setActive("consultor"); setMenuOpen(false); }}><Bot size={18} />Consultor IA<span className="new-badge">IA</span></button>
        </nav>
        <div className="sidebar-bottom"><button><Settings size={18} />Configurações</button><div className="profile"><div className="avatar">AA</div><div><strong>Anderson Araújo</strong><span>Conta pessoal</span></div></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button><div className={`sync-state ${syncState}`}><i/>{syncState === "saved" ? "Dados salvos" : syncState === "loading" ? "Conectando" : "Modo local"}</div><div><span className="capitalize">{periodLabel}{selectedDay !== "all" ? ` · dia ${selectedDay}` : ""}</span></div><button className="primary-button" onClick={openNewTransaction}><Plus size={17} />Novo lançamento</button></header>
        <div className="content">
          {active === "dashboard" && <>
            <section className="page-title"><div><span className="eyebrow">VISÃO GERAL</span><h1>Seu patrimônio, com clareza.</h1><p>Uma leitura consolidada do caixa, compromissos e evolução financeira.</p></div><div className="period-filter"><label><CalendarDays size={16}/><span>Mês</span><input type="month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setSelectedDay("all"); }}/></label><label><span>Categoria</span><select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)}><option value="all">Todas</option>{categories.map(item => <option key={`${item.macro}-${item.name}`}>{item.name}</option>)}</select></label><label><span>Conta</span><select value={selectedAccount} onChange={event => setSelectedAccount(event.target.value)}><option value="all">Todas</option>{accounts.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div></section>
            <section className="kpi-grid">
              <Kpi label="Patrimônio líquido" value={money.format(netWorth)} helper="Ativos menos obrigações" tone="green" icon={Landmark} />
              <Kpi label="Contas + investimentos" value={money.format(accountBalance + portfolioTotal)} helper={`${money.format(accountBalance)} em contas`} tone="blue" icon={WalletCards} />
              <Kpi label="Reserva de emergência" value={money.format(emergencyReserve)} helper={totals.fixed ? `${(emergencyReserve / totals.fixed).toFixed(1)} meses de gastos fixos` : "Classifique um investimento como reserva"} tone="gold" icon={ShieldCheck} />
              <Kpi label="Dívidas" value={money.format(liabilityTotal)} helper="Financiamentos e obrigações" tone="red" icon={ArrowDownRight} />
            </section>
            <section className="health-strip">
              <div><span>ENTRADAS DO MÊS</span><strong>{money.format(totals.income)}</strong><small>receitas registradas</small></div>
              <div><span>SAÍDAS DO MÊS</span><strong>{money.format(totals.expenses)}</strong><small>{previousMonth.expenses ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta.toFixed(1)}% vs. mês anterior` : "sem base anterior"}</small></div>
              <div><span>SALDO E POUPANÇA</span><strong>{money.format(totals.balance)}</strong><small>{totals.savingsRate.toFixed(1)}% da renda preservada</small></div>
              <div><span>PARCELAS FUTURAS</span><strong>{money.format(futureInstallmentTotal)}</strong><small>{futureInstallments.length} parcelas já comprometidas</small></div>
            </section>
            {alerts.length > 0 && <section className="alerts-panel"><Bell size={18}/><div><strong>Alertas financeiros</strong><p>{alerts.join(" • ")}</p></div></section>}
            <section className="insight-banner"><div className="ai-seal"><Sparkles size={22} /></div><div><span>LEITURA DO PERÍODO</span><strong>{filteredTransactions.length ? (totals.balance >= 0 ? "O período terminou com saldo positivo." : "As saídas superaram as entradas neste período.") : "Nenhum lançamento neste período."}</strong><p>{filteredTransactions.length ? `Entradas de ${money.format(totals.income)}, saídas de ${money.format(totals.expenses)} e saldo de ${money.format(totals.balance)}.` : "Escolha outro mês ou cadastre uma entrada ou saída para iniciar a análise."}</p></div><button onClick={() => setActive("consultor")}>Ver análise completa <ArrowUpRight size={16} /></button></section>
            <section className="charts-grid">
              <article className="panel wide"><div className="panel-title"><div><span>EVOLUÇÃO FINANCEIRA</span><h2>Entradas e saídas ao longo do tempo</h2></div><div className="panel-controls"><div className="segmented">{([3,6,12] as const).map(period => <button key={period} className={trendWindow === period ? "active" : ""} onClick={() => setTrendWindow(period)}>{period === 3 ? "Trimestre" : period === 6 ? "Semestre" : "Ano"}</button>)}</div><div className="legend"><i className="income-dot" />Entradas<i className="expense-dot" />Saídas</div></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTrend.slice(-trendWindow)} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f6b52" stopOpacity={0.25}/><stop offset="100%" stopColor="#1f6b52" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e7e5de" strokeDasharray="3 3"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`}/><Tooltip formatter={(v) => money.format(Number(v))}/><Area type="monotone" dataKey="entradas" stroke="#1f6b52" fill="url(#income)" strokeWidth={2.5}/><Area type="monotone" dataKey="saidas" stroke="#b75f51" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></article>
              <article className="panel"><div className="panel-title"><div><span>COMPOSIÇÃO</span><h2>Fixos x variáveis</h2></div></div><div className="donut-row"><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Fixos", value: totals.fixed }, { name: "Variáveis", value: totals.variable }]} innerRadius={55} outerRadius={76} paddingAngle={4} dataKey="value"><Cell fill="#1f6b52"/><Cell fill="#d9a441"/></Pie><Tooltip formatter={(v) => money.format(Number(v))}/></PieChart></ResponsiveContainer><div><strong>{totals.expenses ? ((totals.fixed / totals.expenses) * 100).toFixed(0) : "0"}%</strong><span>fixos</span></div></div><div className="donut-legend"><p><i className="income-dot"/><span>Fixos<small>{money.format(totals.fixed)}</small></span></p><p><i className="gold-dot"/><span>Variáveis<small>{money.format(totals.variable)}</small></span></p></div></div></article>
            </section>
            <section className="bottom-grid"><article className="panel"><div className="panel-title"><div><span>ONDE SAIU</span><h2>Gastos por categoria</h2></div><button onClick={() => setActive("movimentos")}>Ver todos</button></div><div className="bar-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={spendByCategory} layout="vertical" margin={{ left: 10, right: 25 }}><XAxis type="number" hide/><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80}/><Tooltip formatter={(v) => money.format(Number(v))}/><Bar dataKey="value" radius={[0, 7, 7, 0]}>{spendByCategory.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Bar></BarChart></ResponsiveContainer></div></article>
              <article className="panel"><div className="panel-title"><div><span>ÚLTIMOS REGISTROS</span><h2>Movimentações recentes</h2></div><button onClick={() => setActive("movimentos")}>Ver extrato</button></div><div className="transaction-list">{filteredTransactions.length ? filteredTransactions.slice(0, 5).map(t => <div key={t.id}><div className={`transaction-icon ${t.type}`} >{t.type === "entrada" ? <ArrowUpRight size={17}/> : <ArrowDownRight size={17}/>}</div><div><strong>{t.description}</strong><span>{t.category} · {new Date(`${t.date}T12:00`).toLocaleDateString("pt-BR")}</span></div><b className={t.type}>{t.type === "entrada" ? "+" : "−"}{money.format(t.value)}</b></div>) : <EmptyHint>Nenhum registro no período.</EmptyHint>}</div></article>
            </section>
          </>}

          {active === "movimentos" && <section className="section-page"><div className="page-title"><div><span className="eyebrow">CONTROLE</span><h1>Movimentações</h1><p>Entradas e saídas organizadas por categoria, conta e natureza.</p></div><div className="page-actions"><div className="period-filter compact"><label><span>Mês</span><input type="month" value={selectedMonth} onChange={event => { setSelectedMonth(event.target.value); setSelectedDay("all"); }}/></label><label><span>Categoria</span><select value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)}><option value="all">Todas</option>{categories.map(item => <option key={`${item.macro}-${item.name}`}>{item.name}</option>)}</select></label><label><span>Conta</span><select value={selectedAccount} onChange={event => setSelectedAccount(event.target.value)}><option value="all">Todas</option>{accounts.map(item => <option key={item.id}>{item.name}</option>)}</select></label></div><button className="primary-button" onClick={openNewTransaction}><Plus size={17}/>Novo lançamento</button></div></div><div className="panel table-panel"><div className="table-filters"><strong>{filteredTransactions.length} lançamentos</strong><span className="capitalize">{periodLabel}{selectedDay !== "all" ? ` · dia ${selectedDay}` : ""}</span></div><div className="finance-table"><div className="table-head"><span>Data</span><span>Descrição</span><span>Categoria</span><span>Natureza</span><span>Valor</span><span>Ações</span></div>{filteredTransactions.length ? filteredTransactions.map(t => <div className="table-row" key={t.id}><span>{new Date(`${t.date}T12:00`).toLocaleDateString("pt-BR")}</span><strong>{t.description}</strong><span>{t.category}</span><em className={`macro ${t.macro.toLowerCase().replace("á", "a")}`}>{t.macro}</em><b className={t.type}>{t.type === "entrada" ? "+" : "−"}{money.format(t.value)}</b><div className="row-actions"><button onClick={() => { setEditingTransaction(t); setModal("transaction"); }} aria-label={`Editar ${t.description}`} title="Editar"><Pencil size={15}/></button><button className="danger" onClick={() => setDeleteTarget({ entity: "transaction", id: t.id, label: t.description })} aria-label={`Arquivar ${t.description}`} title="Arquivar"><Trash2 size={15}/></button></div></div>) : <EmptyHint>Nenhuma movimentação neste período.</EmptyHint>}</div></div></section>}

          {active === "planejamento" && <section className="section-page"><div className="page-title"><div><span className="eyebrow">PLANEJAMENTO</span><h1>Orçamento e objetivos</h1><p>Planeje antes de gastar e acompanhe seus compromissos.</p></div><div className="page-actions"><label className="secondary-button">Importar CSV<input hidden type="file" accept=".csv" onChange={event => importCsv(event.target.files?.[0])}/></label><button className="secondary-button" onClick={exportCsv}><FileDown size={16}/>Exportar CSV</button><button className="secondary-button" onClick={() => window.print()}>Salvar PDF</button></div></div><div className="planning-grid">
            <article className="panel"><div className="panel-title"><div><span>ORÇADO × REALIZADO</span><h2>Limites por categoria</h2></div></div><form className="inline-form" onSubmit={event => savePlanning(event,"budget")}><input name="month" type="month" defaultValue={selectedMonth} required/><select name="category">{categories.filter(item => item.macro !== "Receita").map(item => <option key={item.name}>{item.name}</option>)}</select><input name="amount" type="number" step="0.01" placeholder="Limite" required/><button>Salvar</button></form><div className="management-list">{budgets.filter(item => item.month === selectedMonth).map(item => { const spent=spendByCategory.find(row => row.name===item.category)?.value||0; return <div key={item.id}><div><strong>{item.category}</strong><span>{money.format(spent)} de {money.format(item.amount)}</span><div className="progress light"><i style={{width:`${Math.min(100,spent/item.amount*100)}%`}}/></div></div><button onClick={()=>deletePlanning("budget",item.id)}><Trash2 size={14}/></button></div>})}</div></article>
            <article className="panel"><div className="panel-title"><div><span>CONTAS, BANCOS E CARTÕES</span><h2>Onde está o dinheiro</h2></div></div><form className="inline-form account-form" onSubmit={event => savePlanning(event,"account")}><input name="name" placeholder="Nome da conta ou cartão" required/><input name="institution" placeholder="Banco ou instituição"/><select name="scope"><option>PF</option><option>PJ</option></select><select name="type"><option>Conta-corrente</option><option>Cartão de crédito</option><option>Dinheiro</option><option>Conta conjunta</option><option>Carteira digital</option></select><input name="balance" type="number" step="0.01" placeholder="Saldo"/><input name="creditLimit" type="number" step="0.01" placeholder="Limite do cartão"/><input name="closingDay" type="number" min="1" max="31" placeholder="Dia fechamento"/><input name="dueDay" type="number" min="1" max="31" placeholder="Dia vencimento"/><button>Adicionar conta</button></form><div className="management-list">{accounts.map(item=><div key={item.id}><div><strong>{item.name} <small className="scope-badge">{item.scope || "PF"}</small></strong><span>{item.institution ? `${item.institution} · ` : ""}{item.type} · {money.format(item.balance)}{item.creditLimit ? ` · limite ${money.format(item.creditLimit)}`:""}{item.dueDay ? ` · vence dia ${item.dueDay}` : ""}</span></div><button onClick={()=>deletePlanning("account",item.id)}><Trash2 size={14}/></button></div>)}</div></article>
            <article className="panel"><div className="panel-title"><div><span>METAS FINANCEIRAS</span><h2>Objetivos com prazo</h2></div></div><form className="inline-form" onSubmit={event => savePlanning(event,"goal")}><input name="name" placeholder="Nome da meta" required/><input name="target" type="number" step="0.01" placeholder="Valor alvo" required/><input name="current" type="number" step="0.01" placeholder="Já acumulado"/><input name="deadline" type="date" required/><button>Adicionar</button></form><div className="management-list">{goals.map(item=><div key={item.id}><div><strong>{item.name}</strong><span>{money.format(item.current)} de {money.format(item.target)} · até {new Date(`${item.deadline}T12:00`).toLocaleDateString("pt-BR")}</span><div className="progress light"><i style={{width:`${Math.min(100,item.current/item.target*100)}%`}}/></div></div><button onClick={()=>deletePlanning("goal",item.id)}><Trash2 size={14}/></button></div>)}</div></article>
            <article className="panel"><div className="panel-title"><div><span>RECORRÊNCIAS</span><h2>Próximo mês comprometido</h2></div></div><div className="recurring-summary"><Repeat2/><strong>{money.format(recurringCommitment)}</strong><span>em despesas mensais recorrentes</span></div><div className="management-list">{transactions.filter(item=>item.recurrence==="Mensal").map(item=><div key={item.id}><div><strong>{item.description}</strong><span>{item.category} · {money.format(item.value)}</span></div></div>)}</div></article>
          </div></section>}

          {active === "patrimonio" && <section className="section-page">
            <div className="page-title"><div><span className="eyebrow">PATRIMÔNIO</span><h1>Evolução patrimonial</h1><p>Cadastre imóveis, automóveis, outros bens e dívidas para acompanhar o valor líquido real.</p></div></div>
            <section className="kpi-grid three"><Kpi label="Valor dos bens" value={money.format(assetTotal)} helper="Valor atual bruto" tone="green" icon={ArrowUpRight}/><Kpi label="Restante a pagar" value={money.format(liabilityTotal)} helper="Financiamentos e dívidas" tone="red" icon={ArrowDownRight}/><Kpi label="Patrimônio líquido" value={money.format(netWorth)} helper="Bens menos valores a pagar" tone="gold" icon={Landmark}/></section>
            <div className="planning-grid patrimony-grid">
              <article className="panel wealth-entry"><div className="panel-title"><div><span>{editingWealth ? "EDITAR PATRIMÔNIO" : "INCLUIR PATRIMÔNIO"}</span><h2>{editingWealth ? "Atualizar ativo ou passivo" : "Novo ativo ou passivo"}</h2></div></div><p className="panel-helper">Para um imóvel ou automóvel financiado, informe o valor atual e quanto ainda falta pagar. O valor líquido será calculado automaticamente.</p>
                <form key={editingWealth?.id || "new-wealth"} className="wealth-form" onSubmit={saveWealth}>
                  <label className="full">Descrição<input name="name" defaultValue={editingWealth?.name || ""} placeholder="Ex.: Casa residencial ou automóvel" required/></label>
                  <label>Natureza<select name="kind" defaultValue={editingWealth?.kind || "Ativo"}><option>Ativo</option><option>Passivo</option></select></label>
                  <label>Tipo<select name="group" defaultValue={editingWealth?.group || "Imóvel"}><option>Imóvel</option><option>Automóvel</option><option>Terreno</option><option>Dinheiro</option><option>Financiamento</option><option>Dívida</option><option>Outro</option></select></label>
                  <label>Valor atual / saldo da dívida<input name="value" type="number" min="0" step="0.01" defaultValue={editingWealth?.value} placeholder="R$ 0,00" required/></label>
                  <label>Dívida vinculada ao bem<input name="remainingDebt" type="number" min="0" step="0.01" defaultValue={editingWealth?.remainingDebt || 0} placeholder="R$ 0,00"/></label>
                  <div className="wealth-form-actions full"><button type="submit">{editingWealth ? <Pencil size={15}/> : <Plus size={15}/>} {editingWealth ? "Salvar atualização" : "Incluir no patrimônio"}</button>{editingWealth && <button className="cancel-wealth" type="button" onClick={()=>setEditingWealth(null)}>Cancelar</button>}</div>
                </form>
              </article>
              <article className="panel"><div className="panel-title"><div><span>COMPOSIÇÃO</span><h2>Bens e obrigações</h2></div></div>
                <div className="wealth-list">{wealthItems.length ? wealthItems.map(item=>{const debt=item.kind==="Ativo"?Number(item.remainingDebt||0):item.value; const liquid=item.kind==="Ativo"?item.value-debt:-item.value; return <div className="wealth-row" key={item.id}><div className="wealth-row-top"><div><strong>{item.name}</strong><span>{item.kind} · {item.group}</span></div><div className="wealth-row-actions"><button onClick={()=>setEditingWealth(item)} aria-label={`Editar ${item.name}`} title="Editar"><Pencil size={15}/></button><button className="danger" onClick={()=>deletePlanning("wealth",item.id)} aria-label={`Excluir ${item.name}`} title="Excluir"><Trash2 size={15}/></button></div></div><div className="wealth-values"><span>{item.kind==="Ativo"?"Valor atual":"Valor da obrigação"}<strong>{money.format(item.value)}</strong></span><span>{item.kind==="Ativo"?"Dívida vinculada":"Passivo total"}<strong className="saida">{money.format(debt)}</strong></span><span>Valor líquido<strong className={liquid>=0?"entrada":"saida"}>{money.format(liquid)}</strong></span></div></div>}) : <EmptyHint>Nenhum ativo ou passivo cadastrado. Use o formulário ao lado para incluir.</EmptyHint>}</div>
              </article>
            </div>
          </section>}

          {active === "categorias" && <section className="section-page"><div className="page-title"><div><span className="eyebrow">ESTRUTURA</span><h1>Categorias</h1><p>Crie classificações e defina se cada gasto é fixo ou variável.</p></div><button className="primary-button" onClick={() => setModal("category")}><Plus size={17}/>Nova categoria</button></div><div className="category-columns">{["Receita", "Fixo", "Variável"].map(macro => <article className="panel" key={macro}><div className="category-header"><div className={`category-mark ${macro.toLowerCase().replace("á", "a")}`}>{macro === "Receita" ? <ArrowUpRight/> : macro === "Fixo" ? <Target/> : <BarChart3/>}</div><div><span>MACROCATEGORIA</span><h2>{macro}</h2></div></div><div className="category-list">{categories.filter(c => c.macro === macro).map(c => <div key={c.name}><span>{c.name}</span><small>{transactions.filter(t => t.category === c.name).length} lançamentos</small></div>)}</div></article>)}</div></section>}

          {active === "investimentos" && <section className="section-page">
            <div className="page-title"><div><span className="eyebrow">PATRIMÔNIO</span><h1>Investimentos</h1><p>Acompanhe alocação, evolução e objetivos da sua carteira.</p></div><div className="page-actions"><div className="period-filter compact"><label><span>Classe</span><select value={selectedInvestmentType} onChange={event => setSelectedInvestmentType(event.target.value)}><option value="all">Todas</option>{[...new Set(investments.map(item => item.type))].map(type => <option key={type}>{type}</option>)}</select></label></div><button className="primary-button" onClick={openNewInvestment}><Plus size={17}/>Novo investimento</button></div></div>
            <section className="investment-hero">
              <div><span>PATRIMÔNIO INVESTIDO</span><strong>{money.format(portfolioTotal)}</strong><p><TrendingUp size={16}/> Rentabilidade média informada de {averageReturn.toFixed(1)}%</p></div>
              <div className="goal">{featuredGoal ? <><div><span>{featuredGoal.name}</span><strong>{money.format(featuredGoal.target)}</strong></div><div className="progress"><i style={{ width: `${Math.min(100, featuredGoal.target ? featuredGoal.current / featuredGoal.target * 100 : 0)}%` }}/></div><small>{featuredGoal.target ? (featuredGoal.current / featuredGoal.target * 100).toFixed(0) : 0}% concluído · {money.format(featuredGoal.current)}</small></> : <><div><span>Meta financeira</span><strong>Não cadastrada</strong></div><small>Crie uma meta em Planejamento para acompanhar o progresso.</small></>}</div>
            </section>
            <div className="investment-grid"><article className="panel"><div className="panel-title"><div><span>ALOCAÇÃO</span><h2>Distribuição da carteira</h2></div></div><div className="portfolio-chart">{filteredInvestments.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={filteredInvestments} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={3}>{filteredInvestments.map((_, i) => <Cell key={i} fill={colors[i % colors.length]}/>)}</Pie><Tooltip formatter={(v) => money.format(Number(v))}/></PieChart></ResponsiveContainer> : <EmptyHint>Nenhum investimento nesta classe.</EmptyHint>}</div></article><article className="panel portfolio-list"><div className="panel-title"><div><span>POSIÇÕES</span><h2>Seus ativos</h2></div></div>{filteredInvestments.length ? filteredInvestments.map((item, i) => <div className="asset-row" key={item.id || item.name}><i style={{ background: colors[i % colors.length] }}/><div><strong>{item.name}</strong><span>{item.type}</span></div><div><strong>{money.format(item.value)}</strong><span className={item.returnPct >= 0 ? "positive" : "saida"}>{item.returnPct >= 0 ? "+" : ""}{item.returnPct.toFixed(1)}%</span></div><div className="row-actions"><button onClick={() => { setEditingInvestment(item); setModal("investment"); }} aria-label={`Editar ${item.name}`} title="Editar"><Pencil size={15}/></button><button className="danger" onClick={() => item.id && setDeleteTarget({ entity: "investment", id: item.id, label: item.name })} aria-label={`Excluir ${item.name}`} title="Excluir"><Trash2 size={15}/></button></div></div>) : <EmptyHint>Nenhum investimento nesta classe.</EmptyHint>}</article></div>
          </section>}

          {active === "assinaturas" && <section className="section-page">
            <div className="page-title"><div><span className="eyebrow">COMPROMISSOS</span><h1>Assinaturas e parcelas</h1><p>Visualize os custos recorrentes e tudo o que já está comprometido no futuro.</p></div></div>
            <section className="kpi-grid three"><Kpi label="Custo mensal" value={money.format(subscriptionMonthly)} helper={`${activeSubscriptions.length} assinaturas ativas`} tone="green" icon={Repeat2}/><Kpi label="Custo anual" value={money.format(subscriptionMonthly * 12)} helper="Projeção em 12 meses" tone="gold" icon={CalendarDays}/><Kpi label="Parcelas futuras" value={money.format(futureInstallmentTotal)} helper={`${futureInstallments.length} vencimentos lançados`} tone="blue" icon={CreditCard}/></section>
            <div className="planning-grid subscriptions-grid">
              <article className="panel"><div className="panel-title"><div><span>NOVA ASSINATURA</span><h2>Cadastro de recorrência</h2></div></div><p className="panel-helper">Cadastre streaming, software, academia, clubes e outros pagamentos automáticos.</p><form className="wealth-form" onSubmit={saveSubscription}><label className="full">Nome<input name="name" placeholder="Ex.: Netflix, academia ou software" required/></label><label>Categoria<select name="category">{categories.filter(item => item.macro !== "Receita").map(item => <option key={item.name}>{item.name}</option>)}</select></label><label>Conta ou cartão<select name="account"><option>Não informado</option>{accounts.map(item => <option key={item.id}>{item.name}</option>)}</select></label><label>Valor mensal<input name="value" type="number" min="0.01" step="0.01" required/></label><label>Dia da cobrança<input name="billingDay" type="number" min="1" max="31" defaultValue="1" required/></label><button className="full" type="submit"><Plus size={15}/>Adicionar assinatura</button></form></article>
              <article className="panel"><div className="panel-title"><div><span>ASSINATURAS ATIVAS</span><h2>Custos recorrentes</h2></div></div><div className="subscription-list">{activeSubscriptions.length ? activeSubscriptions.map(item => <div key={item.id}><div className="subscription-day"><span>DIA</span><strong>{String(item.billingDay).padStart(2,"0")}</strong></div><div><strong>{item.name}</strong><span>{item.category} · {item.account}</span></div><b>{money.format(item.value)}</b><button onClick={() => archiveSubscription(item.id)} aria-label={`Arquivar ${item.name}`} title="Arquivar"><Trash2 size={14}/></button></div>) : <EmptyHint>Nenhuma assinatura ativa.</EmptyHint>}</div></article>
              <article className="panel full-panel"><div className="panel-title"><div><span>AGENDA FUTURA</span><h2>Parcelas já comprometidas</h2></div></div><div className="future-grid">{futureInstallments.length ? futureInstallments.slice(0,12).map(item => <div key={item.id}><span>{new Date(`${item.date}T12:00`).toLocaleDateString("pt-BR")}</span><strong>{item.description}</strong><small>{item.account}</small><b>{money.format(item.value)}</b></div>) : <EmptyHint>Nenhuma compra parcelada com vencimento futuro.</EmptyHint>}</div></article>
            </div>
          </section>}

          {active === "historico" && <section className="section-page">
            <div className="page-title"><div><span className="eyebrow">SEGURANÇA E RASTREABILIDADE</span><h1>Histórico e backup</h1><p>Cada criação, alteração ou arquivamento fica registrado para conferência.</p></div><button className="primary-button" onClick={downloadBackup}><FileDown size={16}/>Baixar backup completo</button></div>
            <section className="audit-banner"><div className="kpi-icon green"><ShieldCheck size={20}/></div><div><strong>Trilha de auditoria protegida</strong><p>Os lançamentos arquivados deixam de afetar os totais, mas seus eventos permanecem no histórico. O backup inclui registros ativos, arquivados e toda a trilha de alterações.</p></div></section>
            <article className="panel audit-panel"><div className="panel-title"><div><span>ÚLTIMOS EVENTOS</span><h2>Histórico de lançamentos</h2></div><small>{auditRows.length} eventos preservados</small></div><div className="audit-list">{auditRows.length ? auditRows.map(item => <div key={item.id}><span className={`audit-action ${item.action.toLowerCase()}`}>{item.action}</span><div><strong>{item.description}</strong><small>Lançamento #{item.transactionId} · {new Date(item.createdAt).toLocaleString("pt-BR")}</small></div><b>{item.value ? money.format(item.value) : "—"}</b></div>) : <EmptyHint>O histórico começará a ser formado a partir dos próximos lançamentos.</EmptyHint>}</div></article>
          </section>}

          {active === "relatorio" && <section className="section-page report-page">
            <div className="page-title report-actions"><div><span className="eyebrow">FECHAMENTO MENSAL</span><h1>Relatório de {periodLabel}</h1><p>Análise executiva pronta para revisar, imprimir e guardar.</p></div><div className="page-actions"><div className="period-filter compact"><label><span>Mês</span><input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)}/></label></div><button className="primary-button" onClick={() => window.print()}><FileDown size={16}/>Gerar PDF</button></div></div>
            <article className="report-sheet">
              <header className="report-header"><div><div className="brand-mark"><CircleDollarSign size={23}/></div><div><span>NEXO · FINANÇAS PESSOAIS</span><h2>Relatório financeiro mensal</h2></div></div><div><span>PERÍODO</span><strong className="capitalize">{periodLabel}</strong><small>Gerado em {new Date().toLocaleDateString("pt-BR")}</small></div></header>
              <section className="report-summary"><span>RESUMO EXECUTIVO</span><h3>{totals.balance >= 0 ? "O mês fechou com geração de caixa positiva." : "O mês exige atenção ao equilíbrio entre renda e despesas."}</h3><p>Foram registrados {filteredTransactions.length} lançamentos, com entradas de {money.format(totals.income)} e saídas de {money.format(totals.expenses)}. O saldo foi de {money.format(totals.balance)}, equivalente a uma taxa de poupança de {totals.savingsRate.toFixed(1)}%.</p></section>
              <section className="report-kpis"><div><span>Entradas</span><strong>{money.format(totals.income)}</strong><small>{previousMonth.income ? `${((totals.income - previousMonth.income) / previousMonth.income * 100).toFixed(1)}% vs. mês anterior` : "Sem base comparativa"}</small></div><div><span>Saídas</span><strong>{money.format(totals.expenses)}</strong><small>{previousMonth.expenses ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta.toFixed(1)}% vs. mês anterior` : "Sem base comparativa"}</small></div><div><span>Saldo</span><strong>{money.format(totals.balance)}</strong><small>{balanceDelta >= 0 ? "+" : ""}{money.format(balanceDelta)} vs. mês anterior</small></div><div><span>Taxa de poupança</span><strong>{totals.savingsRate.toFixed(1)}%</strong><small>da renda registrada</small></div></section>
              <section className="report-grid"><article className="report-chart"><div className="panel-title"><div><span>ÚLTIMOS 12 MESES</span><h2>Evolução de entradas e saídas</h2></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTrend} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e7e5de" strokeDasharray="3 3"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`}/><Tooltip formatter={(v) => money.format(Number(v))}/><Area type="monotone" dataKey="entradas" stroke="#1f6b52" fill="#dcebe4" strokeWidth={2.5}/><Area type="monotone" dataKey="saidas" stroke="#b75f51" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></article><article className="report-ranking"><div className="panel-title"><div><span>CONCENTRAÇÃO</span><h2>Principais despesas</h2></div></div>{spendByCategory.length ? spendByCategory.slice(0,5).map((item,index)=><div key={item.name}><b>{index+1}</b><span>{item.name}</span><strong>{money.format(item.value)}</strong></div>) : <EmptyHint>Sem despesas no período.</EmptyHint>}</article></section>
              <section className="report-insights"><div><span>ANÁLISE AUTOMÁTICA</span><h2>Pontos de atenção e recomendações</h2></div><ol>{reportRecommendations.map(item => <li key={item}>{item}</li>)}</ol></section>
              <section className="report-observations"><span>OBSERVAÇÕES DO MÊS</span><textarea value={reportNote} onChange={event => setReportNote(event.target.value)} placeholder="Registre decisões, imprevistos, aprendizados e ajustes para o próximo mês."/><button className="secondary-button" onClick={saveReportNote}>Salvar observações</button></section>
              <footer className="report-footer"><span>Documento de acompanhamento pessoal</span><span>Nexo · {periodLabel}</span></footer>
            </article>
          </section>}

          {active === "consultor" && <section className="advisor-page"><div className="advisor-intro"><div className="ai-seal large"><Bot size={27}/></div><span className="eyebrow">CONSULTOR FINANCEIRO</span><h1>Decisões melhores começam<br/>com perguntas melhores.</h1><p>Converse sobre seus números, simule planos e receba orientações diretas com base no que você registrou.</p><div className="quick-prompts">{["Onde posso reduzir gastos?", "Como está minha reserva?", "Avalie meus investimentos"].map(p => <button key={p} onClick={() => setQuestion(p)}>{p}</button>)}</div></div><div className="chat-card"><div className="chat-header"><div><Sparkles size={18}/><strong>Análise inteligente</strong></div><span><i/> Dados atualizados</span></div><div className="chat-messages">{chat.map((m, i) => <div className={`message ${m.role}`} key={i}>{m.role === "ai" && <div className="mini-bot"><Bot size={16}/></div>}<p>{m.text}</p></div>)}</div><form className="chat-input" onSubmit={askAdvisor}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Pergunte sobre sua vida financeira..." aria-label="Pergunta ao consultor"/><button aria-label="Enviar"><Send size={18}/></button></form><small className="chat-note">Orientações educacionais. Decisões de investimento exigem avaliação de risco individual.</small></div></section>}
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => { setModal(null); setEditingTransaction(null); setEditingInvestment(null); }}><div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header"><div><span>{modal === "transaction" ? "MOVIMENTAÇÃO" : modal === "category" ? "CLASSIFICAÇÃO" : "PATRIMÔNIO"}</span><h2>{modal === "transaction" ? (editingTransaction ? "Editar lançamento" : "Novo lançamento") : modal === "category" ? "Nova categoria" : (editingInvestment ? "Editar investimento" : "Novo investimento")}</h2></div><button onClick={() => { setModal(null); setEditingTransaction(null); setEditingInvestment(null); }} aria-label="Fechar"><X size={20}/></button></div>
        {modal === "transaction" && <form onSubmit={addTransaction} className="form-grid">
          <label>Tipo<select name="type" defaultValue={editingTransaction?.type || "saida"} required><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label>
          <label>Data<input name="date" type="date" defaultValue={editingTransaction?.date || today} required/></label>
          <label className="full">Descrição<input name="description" defaultValue={editingTransaction?.description || ""} placeholder="Ex.: Supermercado" required/></label>
          <label>Categoria<select name="category" defaultValue={editingTransaction?.category} required>{categories.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
          <label>Valor<input name="value" type="number" min="0.01" step="0.01" defaultValue={editingTransaction?.value} placeholder="0,00" required/></label>
          <label>Conta<select name="account" defaultValue={editingTransaction?.account || "Não informado"}><option>Não informado</option>{accounts.map(account => <option key={account.id}>{account.name}</option>)}</select></label>
          <label>Recorrência<select name="recurrence" defaultValue={editingTransaction?.recurrence || "Não"}><option>Não</option><option>Mensal</option></select></label>
          {!editingTransaction && <label className="full">Número de parcelas<input name="installmentTotal" type="number" min="1" max="120" defaultValue="1"/><small>Se informar mais de uma parcela, o valor total será dividido e os próximos vencimentos serão criados automaticamente.</small></label>}
          <button className="primary-button full" type="submit">{editingTransaction ? "Salvar alterações" : "Salvar lançamento"}</button>
        </form>}
        {modal === "category" && <form onSubmit={addCategory} className="form-grid"><label className="full">Nome<input name="name" placeholder="Ex.: Assinaturas" required/></label><label className="full">Macrocategoria<select name="macro" required><option>Fixo</option><option>Variável</option><option>Receita</option></select></label><button className="primary-button full">Criar categoria</button></form>}
        {modal === "investment" && <form onSubmit={addInvestment} className="form-grid"><label className="full">Investimento<input name="name" defaultValue={editingInvestment?.name || ""} placeholder="Ex.: Tesouro IPCA" required/></label><label>Classe<select name="type" defaultValue={editingInvestment?.type || "Renda fixa"}><option>Renda fixa</option><option>Renda variável</option><option>Internacional</option><option>Imóvel</option></select></label><label>Valor<input name="value" type="number" min="0.01" step="0.01" defaultValue={editingInvestment?.value} required/></label><label className="full">Rentabilidade acumulada (%)<input name="return" type="number" step="0.1" defaultValue={editingInvestment?.returnPct || 0}/></label><button className="primary-button full">{editingInvestment ? "Salvar alterações" : "Salvar investimento"}</button></form>}
      </div></div>}

      {deleteTarget && <div className="modal-backdrop"><div className="modal confirm-modal"><div className="confirm-icon"><Trash2 size={21}/></div><h2>{deleteTarget.entity === "transaction" ? "Arquivar lançamento?" : "Excluir investimento?"}</h2><p>{deleteTarget.entity === "transaction" ? `“${deleteTarget.label}” deixará de afetar os totais, mas continuará preservado no histórico de auditoria.` : `“${deleteTarget.label}” será removido e os totais serão recalculados.`}</p><div className="confirm-actions"><button onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="delete-button" onClick={confirmDelete}>{deleteTarget.entity === "transaction" ? "Arquivar" : "Excluir"}</button></div></div></div>}
    </div>
  );
}
