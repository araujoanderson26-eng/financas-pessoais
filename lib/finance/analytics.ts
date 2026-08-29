import { clamp } from "@/lib/formatters";
import type { FinanceData, Transaction } from "./types";

export type MonthSummary = {
  income: number;
  expenses: number;
  fixed: number;
  variable: number;
  balance: number;
  savingsRate: number;
  count: number;
};

export function transactionsForMonth(transactions: Transaction[], month: string) {
  return transactions.filter((item) => item.date.startsWith(month));
}

export function summarizeTransactions(rows: Transaction[]): MonthSummary {
  const income = rows.filter((item) => item.type === "entrada").reduce((sum, item) => sum + item.value, 0);
  const expenses = rows.filter((item) => item.type === "saida").reduce((sum, item) => sum + item.value, 0);
  const fixed = rows.filter((item) => item.type === "saida" && item.macro === "Fixo").reduce((sum, item) => sum + item.value, 0);
  return {
    income,
    expenses,
    fixed,
    variable: Math.max(0, expenses - fixed),
    balance: income - expenses,
    savingsRate: income ? ((income - expenses) / income) * 100 : 0,
    count: rows.length,
  };
}

export function previousMonthKey(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthlyTrend(transactions: Transaction[], selectedMonth: string, months = 12) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(`${selectedMonth}-01T12:00:00`);
    date.setMonth(date.getMonth() - (months - 1 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const summary = summarizeTransactions(transactionsForMonth(transactions, key));
    return {
      key,
      month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      entradas: summary.income,
      saidas: summary.expenses,
      saldo: summary.balance,
    };
  });
}

export function categoryBreakdown(rows: Transaction[]) {
  const map = new Map<string, number>();
  rows.filter((item) => item.type === "saida").forEach((item) => map.set(item.category, (map.get(item.category) || 0) + item.value));
  const total = [...map.values()].reduce((sum, value) => sum + value, 0);
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, percent: total ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function percentChange(current: number, previous: number) {
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
}

export function getFinancialAnalytics(data: FinanceData, selectedMonth: string, today = new Date()) {
  const rows = transactionsForMonth(data.transactions, selectedMonth);
  const totals = summarizeTransactions(rows);
  const previousKey = previousMonthKey(selectedMonth);
  const previousRows = transactionsForMonth(data.transactions, previousKey);
  const previous = summarizeTransactions(previousRows);
  const portfolioTotal = data.investments.reduce((sum, item) => sum + item.value, 0);
  const accountBalance = data.accounts.filter((item) => item.type !== "Cartão de crédito").reduce((sum, item) => sum + item.balance, 0);
  const emergencyReserve = data.investments
    .filter((item) => /reserva|liquidez|tesouro selic|cdb/i.test(`${item.name} ${item.type}`))
    .reduce((sum, item) => sum + item.value, 0);
  const grossAssets = data.wealthItems.filter((item) => item.kind === "Ativo").reduce((sum, item) => sum + item.value, 0) + portfolioTotal + accountBalance;
  const liabilities = data.wealthItems.reduce((sum, item) => sum + (item.kind === "Passivo" ? item.value : Number(item.remainingDebt || 0)), 0);
  const netWorth = grossAssets - liabilities;
  const activeSubscriptions = data.subscriptions.filter((item) => item.status === "Ativa");
  const subscriptionMonthly = activeSubscriptions.reduce((sum, item) => sum + item.value, 0);
  const recurringCommitment = rows.filter((item) => item.type === "saida" && item.recurrence === "Mensal").reduce((sum, item) => sum + item.value, 0) + subscriptionMonthly;
  const monthEnd = `${selectedMonth}-${new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()}`;
  const futureInstallments = data.transactions.filter((item) => item.type === "saida" && Number(item.installmentTotal || 1) > 1 && item.date > monthEnd);
  const futureInstallmentTotal = futureInstallments.reduce((sum, item) => sum + item.value, 0);
  const monthBudgets = data.budgets.filter((item) => item.month === selectedMonth);
  const budgetTotal = monthBudgets.reduce((sum, item) => sum + item.amount, 0);
  const budgetByCategory = monthBudgets.map((budget) => {
    const actual = rows.filter((item) => item.type === "saida" && item.category === budget.category).reduce((sum, item) => sum + item.value, 0);
    return { ...budget, actual, difference: budget.amount - actual, usedPct: budget.amount ? (actual / budget.amount) * 100 : 0 };
  }).sort((a, b) => b.usedPct - a.usedPct);
  const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const elapsedDays = selectedMonth === currentKey ? today.getDate() : daysInMonth;
  const projectedExpenses = elapsedDays ? (totals.expenses / elapsedDays) * daysInMonth : 0;
  const projectedBalance = totals.income - projectedExpenses;
  const daysRemaining = selectedMonth === currentKey ? Math.max(0, daysInMonth - today.getDate()) : 0;
  const reserveTarget = totals.fixed * 6;
  const reserveMonths = totals.fixed ? emergencyReserve / totals.fixed : 0;
  const categories = categoryBreakdown(rows);
  const previousCategories = new Map(categoryBreakdown(previousRows).map((item) => [item.name, item.value]));
  const categoriesWithComparison = categories.map((item) => ({ ...item, change: percentChange(item.value, previousCategories.get(item.name) || 0) }));
  const averageReturn = portfolioTotal
    ? data.investments.reduce((sum, item) => sum + item.returnPct * item.value, 0) / portfolioTotal
    : 0;

  const factors = [
    { label: "Taxa de poupança", weight: 20, available: totals.income > 0, value: clamp(totals.savingsRate / 20, 0, 1), detail: `${totals.savingsRate.toFixed(1)}% no período` },
    { label: "Reserva de emergência", weight: 25, available: totals.fixed > 0, value: clamp(reserveMonths / 6, 0, 1), detail: `${reserveMonths.toFixed(1)} meses de gastos fixos` },
    { label: "Gastos fixos", weight: 15, available: totals.income > 0, value: clamp(1 - Math.max(0, totals.fixed / totals.income - 0.5) / 0.3, 0, 1), detail: `${totals.income ? ((totals.fixed / totals.income) * 100).toFixed(1) : 0}% da renda` },
    { label: "Endividamento", weight: 15, available: grossAssets > 0 || liabilities > 0, value: liabilities ? clamp(1 - liabilities / Math.max(grossAssets, liabilities) / 0.5, 0, 1) : 1, detail: `${grossAssets ? ((liabilities / grossAssets) * 100).toFixed(1) : 0}% dos ativos` },
    { label: "Resultado mensal", weight: 15, available: rows.length > 0, value: totals.balance >= 0 ? 1 : clamp(1 + totals.balance / Math.max(totals.expenses, 1), 0, 1), detail: totals.balance >= 0 ? "Saldo não negativo" : "Saldo negativo" },
    { label: "Orçamento", weight: 10, available: budgetTotal > 0, value: clamp(1 - Math.max(0, totals.expenses - budgetTotal) / budgetTotal, 0, 1), detail: budgetTotal ? `${((totals.expenses / budgetTotal) * 100).toFixed(1)}% utilizado` : "Sem orçamento no período" },
  ];
  const availableFactors = factors.filter((factor) => factor.available);
  const availableWeight = availableFactors.reduce((sum, factor) => sum + factor.weight, 0);
  const healthScore = availableWeight ? Math.round(availableFactors.reduce((sum, factor) => sum + factor.weight * factor.value, 0) / availableWeight * 100) : 0;
  const healthLabel = healthScore >= 80 ? "Excelente" : healthScore >= 60 ? "Boa" : healthScore >= 40 ? "Em desenvolvimento" : "Atenção";

  const alerts = [
    ...(budgetTotal && totals.expenses > budgetTotal ? [{ level: "important" as const, title: "Orçamento acima do planejado", text: `O realizado superou o orçamento do mês.` }] : []),
    ...(totals.income && totals.fixed / totals.income > 0.6 ? [{ level: "attention" as const, title: "Compromissos fixos relevantes", text: "Os gastos fixos representam mais de 60% da renda registrada." }] : []),
    ...(selectedMonth === currentKey && projectedBalance < 0 && totals.income ? [{ level: "important" as const, title: "Projeção mensal negativa", text: "Mantido o ritmo registrado, as despesas podem superar as receitas." }] : []),
    ...(reserveTarget > 0 && emergencyReserve < reserveTarget ? [{ level: "info" as const, title: "Reserva em formação", text: `A cobertura atual é de ${reserveMonths.toFixed(1)} meses de gastos fixos.` }] : []),
    ...(!data.goals.length ? [{ level: "info" as const, title: "Planejamento de objetivos", text: "Cadastre uma meta financeira para acompanhar aportes e prazo." }] : []),
  ];

  const insights: string[] = [];
  const expenseDelta = percentChange(totals.expenses, previous.expenses);
  if (expenseDelta !== null) insights.push(`As despesas ${expenseDelta >= 0 ? "aumentaram" : "caíram"} ${Math.abs(expenseDelta).toFixed(1)}% em relação ao mês anterior.`);
  if (categoriesWithComparison[0]) insights.push(`${categoriesWithComparison[0].name} representa ${categoriesWithComparison[0].percent.toFixed(1)}% das despesas do período.`);
  if (totals.fixed > 0) insights.push(`A reserva registrada equivale a ${reserveMonths.toFixed(1)} meses dos gastos fixos deste período.`);
  if (previous.income > 0 && totals.income > 0) insights.push(`A taxa de poupança passou de ${previous.savingsRate.toFixed(1)}% para ${totals.savingsRate.toFixed(1)}%.`);

  return {
    rows,
    totals,
    previous,
    previousKey,
    portfolioTotal,
    averageReturn,
    accountBalance,
    emergencyReserve,
    reserveTarget,
    reserveMonths,
    grossAssets,
    liabilities,
    netWorth,
    activeSubscriptions,
    subscriptionMonthly,
    recurringCommitment,
    futureInstallments,
    futureInstallmentTotal,
    budgetTotal,
    budgetByCategory,
    projectedExpenses,
    projectedBalance,
    daysRemaining,
    categories: categoriesWithComparison,
    monthlyTrend: buildMonthlyTrend(data.transactions, selectedMonth),
    healthScore,
    healthLabel,
    healthFactors: availableFactors,
    alerts,
    insights,
  };
}
