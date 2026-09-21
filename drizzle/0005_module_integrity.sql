-- Incremental and non-destructive: existing rows, IDs and history are preserved.
-- Legacy duplicates remain visible; new duplicates are rejected until reconciled.
CREATE INDEX categories_lookup_0 ON categories (owner, name COLLATE NOCASE);
--> statement-breakpoint
CREATE INDEX transactions_lookup_0 ON transactions (owner, date);
--> statement-breakpoint
CREATE INDEX transactions_lookup_1 ON transactions (owner, category);
--> statement-breakpoint
CREATE INDEX transactions_lookup_2 ON transactions (owner, account);
--> statement-breakpoint
CREATE INDEX investments_lookup_0 ON investments (owner);
--> statement-breakpoint
CREATE INDEX accounts_lookup_0 ON accounts (owner, name);
--> statement-breakpoint
CREATE INDEX budgets_lookup_0 ON budgets (owner, month, category);
--> statement-breakpoint
CREATE INDEX goals_lookup_0 ON goals (owner);
--> statement-breakpoint
CREATE INDEX wealth_items_lookup_0 ON wealth_items (owner);
--> statement-breakpoint
CREATE INDEX subscriptions_lookup_0 ON subscriptions (owner, category);
--> statement-breakpoint
CREATE INDEX subscriptions_lookup_1 ON subscriptions (owner, account);
--> statement-breakpoint
CREATE INDEX transaction_events_lookup_0 ON transaction_events (owner, id);
--> statement-breakpoint
CREATE INDEX monthly_notes_lookup_0 ON monthly_notes (owner, month);
--> statement-breakpoint
CREATE TRIGGER categories_unique_insert BEFORE INSERT ON categories
WHEN EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.name COLLATE NOCASE)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER categories_unique_update BEFORE UPDATE ON categories
WHEN EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.name COLLATE NOCASE AND id <> NEW.id)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_unique_insert BEFORE INSERT ON accounts
WHEN EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.name)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_unique_update BEFORE UPDATE ON accounts
WHEN EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.name AND id <> NEW.id)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER budgets_unique_insert BEFORE INSERT ON budgets
WHEN EXISTS (SELECT 1 FROM budgets WHERE owner = NEW.owner AND month = NEW.month AND category = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER budgets_unique_update BEFORE UPDATE ON budgets
WHEN EXISTS (SELECT 1 FROM budgets WHERE owner = NEW.owner AND month = NEW.month AND category = NEW.category AND id <> NEW.id)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER monthly_notes_unique_insert BEFORE INSERT ON monthly_notes
WHEN EXISTS (SELECT 1 FROM monthly_notes WHERE owner = NEW.owner AND month = NEW.month)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER monthly_notes_unique_update BEFORE UPDATE ON monthly_notes
WHEN EXISTS (SELECT 1 FROM monthly_notes WHERE owner = NEW.owner AND month = NEW.month AND id <> NEW.id)
BEGIN SELECT RAISE(ABORT, 'FINANCE_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_category_insert BEFORE INSERT ON transactions
WHEN NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_category_update BEFORE UPDATE ON transactions
WHEN NEW.category <> OLD.category AND NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER budgets_category_insert BEFORE INSERT ON budgets
WHEN NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER budgets_category_update BEFORE UPDATE ON budgets
WHEN NEW.category <> OLD.category AND NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER subscriptions_category_insert BEFORE INSERT ON subscriptions
WHEN NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER subscriptions_category_update BEFORE UPDATE ON subscriptions
WHEN NEW.category <> OLD.category AND NOT EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER categories_delete_guard BEFORE DELETE ON categories
WHEN EXISTS (SELECT 1 FROM transactions WHERE owner = OLD.owner AND category = OLD.name)
 OR EXISTS (SELECT 1 FROM budgets WHERE owner = OLD.owner AND category = OLD.name)
 OR EXISTS (SELECT 1 FROM subscriptions WHERE owner = OLD.owner AND category = OLD.name)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER accounts_delete_guard BEFORE DELETE ON accounts
WHEN EXISTS (SELECT 1 FROM transactions WHERE owner = OLD.owner AND account = OLD.name)
 OR EXISTS (SELECT 1 FROM subscriptions WHERE owner = OLD.owner AND account = OLD.name)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_account_insert BEFORE INSERT ON transactions
WHEN NEW.account <> 'Não informado' AND NOT EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.account)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_account_update BEFORE UPDATE ON transactions
WHEN NEW.account <> OLD.account AND NEW.account <> 'Não informado' AND NOT EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.account)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER subscriptions_account_insert BEFORE INSERT ON subscriptions
WHEN NEW.account <> 'Não informado' AND NOT EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.account)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER subscriptions_account_update BEFORE UPDATE ON subscriptions
WHEN NEW.account <> OLD.account AND NEW.account <> 'Não informado' AND NOT EXISTS (SELECT 1 FROM accounts WHERE owner = NEW.owner AND name = NEW.account)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
--> statement-breakpoint
CREATE TRIGGER transactions_audit_insert AFTER INSERT ON transactions BEGIN
INSERT INTO transaction_events (owner,transaction_id,action,snapshot,created_at) VALUES (NEW.owner, NEW.id, 'Criado', json_object('id',NEW.id,'date',NEW.date,'description',NEW.description,'category',NEW.category,'macro',NEW.macro,'type',NEW.type,'value',NEW.value,'account',NEW.account,'recurrence',NEW.recurrence,'installmentCurrent',NEW.installment_current,'installmentTotal',NEW.installment_total), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER transactions_audit_update AFTER UPDATE ON transactions BEGIN
INSERT INTO transaction_events (owner,transaction_id,action,snapshot,created_at) VALUES (NEW.owner, NEW.id, CASE WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN 'Arquivado' ELSE 'Atualizado' END, CASE WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN json_object('id',OLD.id,'date',OLD.date,'description',OLD.description,'category',OLD.category,'macro',OLD.macro,'type',OLD.type,'value',OLD.value,'account',OLD.account,'recurrence',OLD.recurrence,'installmentCurrent',OLD.installment_current,'installmentTotal',OLD.installment_total) ELSE json_object('before',json_object('id',OLD.id,'date',OLD.date,'description',OLD.description,'category',OLD.category,'macro',OLD.macro,'type',OLD.type,'value',OLD.value,'account',OLD.account,'recurrence',OLD.recurrence,'installmentCurrent',OLD.installment_current,'installmentTotal',OLD.installment_total),'after',json_object('id',NEW.id,'date',NEW.date,'description',NEW.description,'category',NEW.category,'macro',NEW.macro,'type',NEW.type,'value',NEW.value,'account',NEW.account,'recurrence',NEW.recurrence,'installmentCurrent',NEW.installment_current,'installmentTotal',NEW.installment_total)) END, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
