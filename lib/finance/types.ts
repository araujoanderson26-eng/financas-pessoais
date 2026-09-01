export type Tab =
  | "dashboard"
  | "movimentos"
  | "planejamento"
  | "patrimonio"
  | "categorias"
  | "investimentos"
  | "assinaturas"
  | "relatorio"
  | "historico"
  | "consultor"
  | "configuracoes";

export type Transaction = {
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

export type FinancialMacro = "Fixo" | "Variável" | "Receita";
export type Category = {
  id: number;
  name: string;
  macro: FinancialMacro;
  transactionCount?: number;
  budgetCount?: number;
  subscriptionCount?: number;
  referenceCount?: number;
};
export type Investment = { id?: number; name: string; type: string; value: number; returnPct: number };
export type Account = {
  id: number;
  name: string;
  type: string;
  balance: number;
  creditLimit: number;
  scope?: string;
  institution?: string;
  closingDay?: number;
  dueDay?: number;
};
export type Budget = { id: number; month: string; category: string; amount: number };
export type Goal = { id: number; name: string; target: number; current: number; deadline: string };
export type WealthItem = {
  id: number;
  name: string;
  kind: "Ativo" | "Passivo";
  group: string;
  value: number;
  remainingDebt: number;
};
export type Subscription = {
  id: number;
  name: string;
  category: string;
  account: string;
  value: number;
  billingDay: number;
  status: "Ativa" | "Inativa";
};
export type AuditEvent = { id: number; transactionId: number; action: string; snapshot: string; createdAt: string };
export type ReportNote = { id: number; month: string; note: string; updatedAt: string };

export type UserSettings = {
  profileName: string;
  productName: string;
  signature: string;
  currency: "BRL";
  locale: "pt-BR";
  dateFormat: "DD/MM/AAAA";
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  hideValues: boolean;
  exportIdentity: boolean;
  exportOwner: boolean;
  exportGeneratedAt: boolean;
  exportTotals: boolean;
  exportFilters: boolean;
  exportFreezeHeader: boolean;
  updatedAt?: string;
};

export type FinancialSnapshot = {
  id: number;
  snapshotDate: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  accountBalance: number;
  investments: number;
  emergencyReserve: number;
  createdAt: string;
};

export type BackupEvent = { id: number; kind: string; createdAt: string };

export type FinanceData = {
  categories: Category[];
  transactions: Transaction[];
  investments: Investment[];
  accounts: Account[];
  budgets: Budget[];
  goals: Goal[];
  wealthItems: WealthItem[];
  subscriptions: Subscription[];
  auditEvents: AuditEvent[];
  reportNotes: ReportNote[];
  settings: UserSettings;
  snapshots: FinancialSnapshot[];
  backupEvents: BackupEvent[];
};

export const DEFAULT_SETTINGS: UserSettings = {
  profileName: "Anderson de Araujo",
  productName: "Nexo Finanças Pessoais",
  signature: "by Anderson de Araujo",
  currency: "BRL",
  locale: "pt-BR",
  dateFormat: "DD/MM/AAAA",
  theme: "system",
  density: "comfortable",
  hideValues: false,
  exportIdentity: true,
  exportOwner: true,
  exportGeneratedAt: true,
  exportTotals: true,
  exportFilters: true,
  exportFreezeHeader: true,
};

export const EMPTY_FINANCE_DATA: FinanceData = {
  categories: [],
  transactions: [],
  investments: [],
  accounts: [],
  budgets: [],
  goals: [],
  wealthItems: [],
  subscriptions: [],
  auditEvents: [],
  reportNotes: [],
  settings: DEFAULT_SETTINGS,
  snapshots: [],
  backupEvents: [],
};
