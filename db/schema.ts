import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  macro: text("macro").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  macro: text("macro").notNull(),
  type: text("type").notNull(),
  value: real("value").notNull(),
  account: text("account").notNull().default("Não informado"),
  recurrence: text("recurrence").notNull().default("Não"),
  installmentCurrent: integer("installment_current").notNull().default(1),
  installmentTotal: integer("installment_total").notNull().default(1),
  archivedAt: text("archived_at"),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }), owner: text("owner").notNull(),
  name: text("name").notNull(), type: text("type").notNull(), balance: real("balance").notNull().default(0),
  creditLimit: real("credit_limit").notNull().default(0),
  scope: text("scope").notNull().default("PF"),
  institution: text("institution").notNull().default(""),
  closingDay: integer("closing_day").notNull().default(0),
  dueDay: integer("due_day").notNull().default(0),
});

export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }), owner: text("owner").notNull(),
  month: text("month").notNull(), category: text("category").notNull(), amount: real("amount").notNull(),
});

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }), owner: text("owner").notNull(),
  name: text("name").notNull(), target: real("target").notNull(), current: real("current").notNull().default(0),
  deadline: text("deadline").notNull(),
});

export const wealthItems = sqliteTable("wealth_items", {
  id: integer("id").primaryKey({ autoIncrement: true }), owner: text("owner").notNull(),
  name: text("name").notNull(), kind: text("kind").notNull(), group: text("group_name").notNull(), value: real("value").notNull(),
  remainingDebt: real("remaining_debt").notNull().default(0),
});

export const investments = sqliteTable("investments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  value: real("value").notNull(),
  returnPct: real("return_pct").notNull().default(0),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  account: text("account").notNull().default("Não informado"),
  value: real("value").notNull(),
  billingDay: integer("billing_day").notNull().default(1),
  status: text("status").notNull().default("Ativa"),
});

export const transactionEvents = sqliteTable("transaction_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  transactionId: integer("transaction_id").notNull(),
  action: text("action").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
});

export const monthlyNotes = sqliteTable("monthly_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  month: text("month").notNull(),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const userSettings = sqliteTable("user_settings", {
  owner: text("owner").primaryKey(),
  profileName: text("profile_name").notNull().default("Anderson de Araujo"),
  productName: text("product_name").notNull().default("Nexo Finanças Pessoais"),
  signature: text("signature").notNull().default("by Anderson de Araujo"),
  currency: text("currency").notNull().default("BRL"),
  locale: text("locale").notNull().default("pt-BR"),
  dateFormat: text("date_format").notNull().default("DD/MM/AAAA"),
  theme: text("theme").notNull().default("system"),
  density: text("density").notNull().default("comfortable"),
  hideValues: integer("hide_values", { mode: "boolean" }).notNull().default(false),
  exportIdentity: integer("export_identity", { mode: "boolean" }).notNull().default(true),
  exportOwner: integer("export_owner", { mode: "boolean" }).notNull().default(true),
  exportGeneratedAt: integer("export_generated_at", { mode: "boolean" }).notNull().default(true),
  exportTotals: integer("export_totals", { mode: "boolean" }).notNull().default(true),
  exportFilters: integer("export_filters", { mode: "boolean" }).notNull().default(true),
  exportFreezeHeader: integer("export_freeze_header", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const financialSnapshots = sqliteTable("financial_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  netWorth: real("net_worth").notNull().default(0),
  assets: real("assets").notNull().default(0),
  liabilities: real("liabilities").notNull().default(0),
  accountBalance: real("account_balance").notNull().default(0),
  investments: real("investments").notNull().default(0),
  emergencyReserve: real("emergency_reserve").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const backupEvents = sqliteTable("backup_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  owner: text("owner").notNull(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});
