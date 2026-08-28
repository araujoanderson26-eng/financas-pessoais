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
