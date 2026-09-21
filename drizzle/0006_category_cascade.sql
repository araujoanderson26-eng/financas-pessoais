-- Cascade from the actual OLD row, even when concurrent clients read stale names.
CREATE TRIGGER categories_cascade_update AFTER UPDATE OF name, macro ON categories
WHEN NEW.name <> OLD.name OR NEW.macro <> OLD.macro
BEGIN
  UPDATE transactions SET category = NEW.name, macro = NEW.macro WHERE owner = OLD.owner AND category = OLD.name;
  UPDATE budgets SET category = NEW.name WHERE owner = OLD.owner AND category = OLD.name;
  UPDATE subscriptions SET category = NEW.name WHERE owner = OLD.owner AND category = OLD.name;
END;
CREATE TRIGGER IF NOT EXISTS transactions_macro_insert BEFORE INSERT ON transactions
WHEN EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category AND macro <> NEW.macro)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
CREATE TRIGGER IF NOT EXISTS transactions_macro_update BEFORE UPDATE OF category, macro ON transactions
WHEN (NEW.category <> OLD.category OR NEW.macro <> OLD.macro)
 AND EXISTS (SELECT 1 FROM categories WHERE owner = NEW.owner AND name = NEW.category AND macro <> NEW.macro)
BEGIN SELECT RAISE(ABORT, 'FINANCE_REFERENCE'); END;
