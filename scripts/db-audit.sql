-- Read-only integrity report. Does not expose owner names or record contents.
SELECT 'duplicate_categories' AS check_name, COUNT(*) AS issues FROM
 (SELECT owner, lower(name) FROM categories GROUP BY owner, lower(name) HAVING COUNT(*) > 1);
SELECT 'duplicate_budgets' AS check_name, COUNT(*) AS issues FROM
 (SELECT owner, month, category FROM budgets GROUP BY owner, month, category HAVING COUNT(*) > 1);
SELECT 'duplicate_notes' AS check_name, COUNT(*) AS issues FROM
 (SELECT owner, month FROM monthly_notes GROUP BY owner, month HAVING COUNT(*) > 1);
SELECT 'orphan_transaction_categories' AS check_name, COUNT(*) AS issues FROM transactions t
 WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.owner=t.owner AND c.name=t.category);
SELECT 'inconsistent_transaction_macros' AS check_name, COUNT(*) AS issues FROM transactions t
 WHERE EXISTS (SELECT 1 FROM categories c WHERE c.owner=t.owner AND c.name=t.category AND c.macro<>t.macro);
SELECT 'invalid_transaction_values' AS check_name, COUNT(*) AS issues FROM transactions
 WHERE value<=0 OR type NOT IN ('entrada','saida') OR installment_total<1 OR installment_total<>CAST(installment_total AS INTEGER);
SELECT 'orphan_accounts' AS check_name, COUNT(*) AS issues FROM transactions t
 WHERE t.account<>'Não informado' AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.owner=t.owner AND a.name=t.account);
