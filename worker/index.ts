/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const defaultCategories = [
  ["Salário", "Receita"], ["Renda de imóvel", "Receita"], ["Moradia", "Fixo"],
  ["Transporte", "Fixo"], ["Saúde", "Fixo"], ["Educação", "Fixo"],
  ["Alimentação", "Variável"], ["Lazer", "Variável"], ["Compras", "Variável"],
];

const allowedCategoryMacros = new Set(["Fixo", "Variável", "Receita"]);
const categorySelect = `
  SELECT
    c.id,
    c.name,
    c.macro,
    (SELECT COUNT(*) FROM transactions t WHERE t.owner = c.owner AND t.category = c.name) AS transactionCount,
    (SELECT COUNT(*) FROM budgets b WHERE b.owner = c.owner AND b.category = c.name) AS budgetCount,
    (SELECT COUNT(*) FROM subscriptions s WHERE s.owner = c.owner AND s.category = c.name) AS subscriptionCount,
    (
      (SELECT COUNT(*) FROM transactions t WHERE t.owner = c.owner AND t.category = c.name) +
      (SELECT COUNT(*) FROM budgets b WHERE b.owner = c.owner AND b.category = c.name) +
      (SELECT COUNT(*) FROM subscriptions s WHERE s.owner = c.owner AND s.category = c.name)
    ) AS referenceCount
  FROM categories c
  WHERE c.owner = ?
  ORDER BY c.name COLLATE NOCASE, c.id
`;

type CategoryRow = { id: number; name: string; macro: string };
type CategoryReferenceCounts = { transactionCount: number; budgetCount: number; subscriptionCount: number; referenceCount: number };

const categoryInput = (payload: Record<string, unknown>) => ({
  name: String(payload.name || "").trim(),
  macro: String(payload.macro || ""),
});

const validId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function categoryById(db: D1Database, owner: string, id: number) {
  return db.prepare("SELECT id, name, macro FROM categories WHERE id = ? AND owner = ?").bind(id, owner).first<CategoryRow>();
}

async function categoryByName(db: D1Database, owner: string, name: string, excludedId?: number) {
  const query = excludedId
    ? "SELECT id, name, macro FROM categories WHERE owner = ? AND name = ? COLLATE NOCASE AND id <> ? LIMIT 1"
    : "SELECT id, name, macro FROM categories WHERE owner = ? AND name = ? COLLATE NOCASE LIMIT 1";
  const statement = db.prepare(query);
  return (excludedId ? statement.bind(owner, name, excludedId) : statement.bind(owner, name)).first<CategoryRow>();
}

async function categoryReferenceCounts(db: D1Database, owner: string, name: string) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM transactions WHERE owner = ? AND category = ?) AS transactionCount,
      (SELECT COUNT(*) FROM budgets WHERE owner = ? AND category = ?) AS budgetCount,
      (SELECT COUNT(*) FROM subscriptions WHERE owner = ? AND category = ?) AS subscriptionCount,
      (
        (SELECT COUNT(*) FROM transactions WHERE owner = ? AND category = ?) +
        (SELECT COUNT(*) FROM budgets WHERE owner = ? AND category = ?) +
        (SELECT COUNT(*) FROM subscriptions WHERE owner = ? AND category = ?)
      ) AS referenceCount
  `).bind(owner, name, owner, name, owner, name, owner, name, owner, name, owner, name).first<CategoryReferenceCounts>();
}

const defaultSettings = {
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

const saoPauloDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const asBoolean = (value: unknown) => value === true || value === 1 || value === "1";
const normalizeSettings = (row?: Record<string, unknown> | null) => ({
  profileName: String(row?.profileName || defaultSettings.profileName),
  productName: String(row?.productName || defaultSettings.productName),
  signature: String(row?.signature || defaultSettings.signature),
  currency: "BRL" as const,
  locale: "pt-BR" as const,
  dateFormat: "DD/MM/AAAA" as const,
  theme: (["light", "dark", "system"].includes(String(row?.theme)) ? String(row?.theme) : defaultSettings.theme) as "light" | "dark" | "system",
  density: (["comfortable", "compact"].includes(String(row?.density)) ? String(row?.density) : defaultSettings.density) as "comfortable" | "compact",
  hideValues: asBoolean(row?.hideValues),
  exportIdentity: row?.exportIdentity === undefined ? true : asBoolean(row.exportIdentity),
  exportOwner: row?.exportOwner === undefined ? true : asBoolean(row.exportOwner),
  exportGeneratedAt: row?.exportGeneratedAt === undefined ? true : asBoolean(row.exportGeneratedAt),
  exportTotals: row?.exportTotals === undefined ? true : asBoolean(row.exportTotals),
  exportFilters: row?.exportFilters === undefined ? true : asBoolean(row.exportFilters),
  exportFreezeHeader: row?.exportFreezeHeader === undefined ? true : asBoolean(row.exportFreezeHeader),
  updatedAt: row?.updatedAt ? String(row.updatedAt) : undefined,
});

const json = (data: unknown, status = 200) => Response.json(data, { status });
const ownerOf = (request: Request) => {
  const url = new URL(request.url);
  return request.headers.get("cf-access-authenticated-user-email")
    || request.headers.get("oai-authenticated-user-email")
    || (["localhost", "127.0.0.1"].includes(url.hostname) ? "owner@local" : null);
};

async function financeApi(request: Request, env: Env) {
  const owner = ownerOf(request);
  if (!owner) return json({ error: "Acesso protegido. Configure o Cloudflare Access para continuar." }, 401);
  if (request.method === "GET") {
    let categoryResult = await env.DB.prepare(categorySelect).bind(owner).all();
    if (!categoryResult.results.length) {
      await env.DB.batch(defaultCategories.map(([name, macro]) => env.DB.prepare("INSERT INTO categories (owner, name, macro) VALUES (?, ?, ?)").bind(owner, name, macro)));
      categoryResult = await env.DB.prepare(categorySelect).bind(owner).all();
    }
    const [transactionResult, investmentResult, accountResult, budgetResult, goalResult, wealthResult, subscriptionResult, eventResult, noteResult, settingsResult, backupResult] = await Promise.all([
      env.DB.prepare("SELECT id, date, description, category, macro, type, value, account, recurrence, installment_current AS installmentCurrent, installment_total AS installmentTotal FROM transactions WHERE owner = ? AND archived_at IS NULL ORDER BY date DESC, id DESC").bind(owner).all(),
      env.DB.prepare("SELECT id, name, type, value, return_pct AS returnPct FROM investments WHERE owner = ? ORDER BY id").bind(owner).all(),
      env.DB.prepare("SELECT id, name, type, balance, credit_limit AS creditLimit, scope, institution, closing_day AS closingDay, due_day AS dueDay FROM accounts WHERE owner = ? ORDER BY id").bind(owner).all(),
      env.DB.prepare("SELECT id, month, category, amount FROM budgets WHERE owner = ? ORDER BY category").bind(owner).all(),
      env.DB.prepare("SELECT id, name, target, current, deadline FROM goals WHERE owner = ? ORDER BY deadline").bind(owner).all(),
      env.DB.prepare("SELECT id, name, kind, group_name AS 'group', value, remaining_debt AS remainingDebt FROM wealth_items WHERE owner = ? ORDER BY kind, id").bind(owner).all(),
      env.DB.prepare("SELECT id, name, category, account, value, billing_day AS billingDay, status FROM subscriptions WHERE owner = ? ORDER BY status, billing_day, name").bind(owner).all(),
      env.DB.prepare("SELECT id, transaction_id AS transactionId, action, snapshot, created_at AS createdAt FROM transaction_events WHERE owner = ? ORDER BY id DESC LIMIT 300").bind(owner).all(),
      env.DB.prepare("SELECT id, month, note, updated_at AS updatedAt FROM monthly_notes WHERE owner = ? ORDER BY month DESC").bind(owner).all(),
      env.DB.prepare("SELECT profile_name AS profileName, product_name AS productName, signature, currency, locale, date_format AS dateFormat, theme, density, hide_values AS hideValues, export_identity AS exportIdentity, export_owner AS exportOwner, export_generated_at AS exportGeneratedAt, export_totals AS exportTotals, export_filters AS exportFilters, export_freeze_header AS exportFreezeHeader, updated_at AS updatedAt FROM user_settings WHERE owner = ?").bind(owner).first<Record<string, unknown>>(),
      env.DB.prepare("SELECT id, kind, created_at AS createdAt FROM backup_events WHERE owner = ? ORDER BY id DESC LIMIT 20").bind(owner).all(),
    ]);
    let settings = settingsResult;
    if (!settings) {
      const now = new Date().toISOString();
      settings = await env.DB.prepare("INSERT INTO user_settings (owner, updated_at) VALUES (?, ?) RETURNING profile_name AS profileName, product_name AS productName, signature, currency, locale, date_format AS dateFormat, theme, density, hide_values AS hideValues, export_identity AS exportIdentity, export_owner AS exportOwner, export_generated_at AS exportGeneratedAt, export_totals AS exportTotals, export_filters AS exportFilters, export_freeze_header AS exportFreezeHeader, updated_at AS updatedAt").bind(owner, now).first<Record<string, unknown>>();
    }

    const investmentRows = investmentResult.results as Array<Record<string, unknown>>;
    const accountRows = accountResult.results as Array<Record<string, unknown>>;
    const wealthRows = wealthResult.results as Array<Record<string, unknown>>;
    const investmentsTotal = investmentRows.reduce((sum, item) => sum + Number(item.value || 0), 0);
    const accountBalance = accountRows.filter((item) => item.type !== "Cartão de crédito").reduce((sum, item) => sum + Number(item.balance || 0), 0);
    const emergencyReserve = investmentRows.filter((item) => /reserva|liquidez|tesouro selic|cdb/i.test(`${item.name || ""} ${item.type || ""}`)).reduce((sum, item) => sum + Number(item.value || 0), 0);
    const wealthAssets = wealthRows.filter((item) => item.kind === "Ativo").reduce((sum, item) => sum + Number(item.value || 0), 0);
    const liabilities = wealthRows.reduce((sum, item) => sum + (item.kind === "Passivo" ? Number(item.value || 0) : Number(item.remainingDebt || 0)), 0);
    const assets = wealthAssets + investmentsTotal + accountBalance;
    const snapshotDate = saoPauloDate();
    const createdAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO financial_snapshots (owner, snapshot_date, net_worth, assets, liabilities, account_balance, investments, emergency_reserve, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner, snapshot_date) DO UPDATE SET net_worth = excluded.net_worth, assets = excluded.assets, liabilities = excluded.liabilities, account_balance = excluded.account_balance, investments = excluded.investments, emergency_reserve = excluded.emergency_reserve, created_at = excluded.created_at").bind(owner, snapshotDate, assets - liabilities, assets, liabilities, accountBalance, investmentsTotal, emergencyReserve, createdAt).run();
    const snapshotResult = await env.DB.prepare("SELECT id, snapshot_date AS snapshotDate, net_worth AS netWorth, assets, liabilities, account_balance AS accountBalance, investments, emergency_reserve AS emergencyReserve, created_at AS createdAt FROM financial_snapshots WHERE owner = ? ORDER BY snapshot_date ASC LIMIT 730").bind(owner).all();

    return json({ categories: categoryResult.results, transactions: transactionResult.results, investments: investmentResult.results, accounts: accountResult.results, budgets: budgetResult.results, goals: goalResult.results, wealthItems: wealthResult.results, subscriptions: subscriptionResult.results, auditEvents: eventResult.results, reportNotes: noteResult.results, settings: normalizeSettings(settings), snapshots: snapshotResult.results, backupEvents: backupResult.results });
  }
  if (request.method === "POST") {
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action || "");
    if (action === "transaction") {
      const selectedCategory = await categoryByName(env.DB, owner, String(payload.category || "").trim());
      if (!selectedCategory) return json({ error: "Selecione uma categoria válida." }, 400);
      const installmentTotal = Math.max(1, Math.min(120, Number(payload.installmentTotal || 1)));
      const totalValue = Number(payload.value);
      const baseDate = new Date(`${String(payload.date)}T12:00:00Z`);
      const prepared = Array.from({ length: installmentTotal }, (_, index) => {
        const date = new Date(baseDate);
        date.setUTCMonth(date.getUTCMonth() + index);
        const installmentValue = index === installmentTotal - 1 ? totalValue - Math.round((totalValue / installmentTotal) * 100) / 100 * (installmentTotal - 1) : Math.round((totalValue / installmentTotal) * 100) / 100;
        const description = installmentTotal > 1 ? `${String(payload.description)} (${index + 1}/${installmentTotal})` : String(payload.description);
        return env.DB.prepare("INSERT INTO transactions (owner, date, description, category, macro, type, value, account, recurrence, installment_current, installment_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, date, description, category, macro, type, value, account, recurrence, installment_current AS installmentCurrent, installment_total AS installmentTotal").bind(owner, date.toISOString().slice(0, 10), description, selectedCategory.name, selectedCategory.macro, payload.type, installmentValue, payload.account || "Não informado", payload.recurrence || "Não", index + 1, installmentTotal);
      });
      const inserted = await env.DB.batch(prepared);
      const items = inserted.flatMap(result => result.results || []) as Array<Record<string, unknown>>;
      if (items.length) await env.DB.batch(items.map(item => env.DB.prepare("INSERT INTO transaction_events (owner, transaction_id, action, snapshot, created_at) VALUES (?, ?, ?, ?, ?)").bind(owner, Number(item.id), "Criado", JSON.stringify(item), new Date().toISOString())));
      return json({ item: items[0], items }, 201);
    }
    if (action === "update_transaction") {
      const selectedCategory = await categoryByName(env.DB, owner, String(payload.category || "").trim());
      if (!selectedCategory) return json({ error: "Selecione uma categoria válida." }, 400);
      const before = await env.DB.prepare("SELECT * FROM transactions WHERE id = ? AND owner = ?").bind(Number(payload.id), owner).first();
      const result = await env.DB.prepare("UPDATE transactions SET date = ?, description = ?, category = ?, macro = ?, type = ?, value = ?, account = ?, recurrence = ? WHERE id = ? AND owner = ? AND archived_at IS NULL RETURNING id, date, description, category, macro, type, value, account, recurrence, installment_current AS installmentCurrent, installment_total AS installmentTotal").bind(payload.date, payload.description, selectedCategory.name, selectedCategory.macro, payload.type, Number(payload.value), payload.account || "Não informado", payload.recurrence || "Não", Number(payload.id), owner).first();
      if (!result) return json({ error: "Lançamento não encontrado" }, 404);
      await env.DB.prepare("INSERT INTO transaction_events (owner, transaction_id, action, snapshot, created_at) VALUES (?, ?, ?, ?, ?)").bind(owner, Number(payload.id), "Atualizado", JSON.stringify({ before, after: result }), new Date().toISOString()).run();
      return json({ item: result });
    }
    if (action === "delete_transaction") {
      const before = await env.DB.prepare("SELECT * FROM transactions WHERE id = ? AND owner = ? AND archived_at IS NULL").bind(Number(payload.id), owner).first();
      const result = await env.DB.prepare("UPDATE transactions SET archived_at = ? WHERE id = ? AND owner = ? AND archived_at IS NULL RETURNING id").bind(new Date().toISOString(), Number(payload.id), owner).first();
      if (!result) return json({ error: "Lançamento não encontrado" }, 404);
      await env.DB.prepare("INSERT INTO transaction_events (owner, transaction_id, action, snapshot, created_at) VALUES (?, ?, ?, ?, ?)").bind(owner, Number(payload.id), "Arquivado", JSON.stringify(before), new Date().toISOString()).run();
      return json({ deleted: result });
    }
    if (action === "category") {
      const { name, macro } = categoryInput(payload);
      if (!name) return json({ error: "Informe o nome da categoria." }, 400);
      if (!allowedCategoryMacros.has(macro)) return json({ error: "Macrocategoria inválida." }, 400);
      const duplicate = await categoryByName(env.DB, owner, name);
      if (duplicate) return json({ error: "Esta categoria já existe." }, 409);
      const result = await env.DB.prepare("INSERT INTO categories (owner, name, macro) VALUES (?, ?, ?) RETURNING id, name, macro").bind(owner, name, macro).first();
      return json({ item: result }, 201);
    }
    if (action === "update_category") {
      const id = validId(payload.id);
      if (!id) return json({ error: "Categoria inválida." }, 400);
      const current = await categoryById(env.DB, owner, id);
      if (!current) return json({ error: "Categoria não encontrada." }, 404);
      const { name, macro } = categoryInput(payload);
      if (!name) return json({ error: "Informe o nome da categoria." }, 400);
      if (!allowedCategoryMacros.has(macro)) return json({ error: "Macrocategoria inválida." }, 400);
      const duplicate = await categoryByName(env.DB, owner, name, id);
      if (duplicate) return json({ error: "Esta categoria já existe." }, 409);

      const [updated] = await env.DB.batch([
        env.DB.prepare("UPDATE categories SET name = ?, macro = ? WHERE id = ? AND owner = ? RETURNING id, name, macro").bind(name, macro, id, owner),
        env.DB.prepare("UPDATE transactions SET category = ?, macro = ? WHERE owner = ? AND category = ?").bind(name, macro, owner, current.name),
        env.DB.prepare("UPDATE budgets SET category = ? WHERE owner = ? AND category = ?").bind(name, owner, current.name),
        env.DB.prepare("UPDATE subscriptions SET category = ? WHERE owner = ? AND category = ?").bind(name, owner, current.name),
      ]);
      return json({ item: updated.results?.[0] });
    }
    if (action === "delete_category") {
      const id = validId(payload.id);
      if (!id) return json({ error: "Categoria inválida." }, 400);
      const current = await categoryById(env.DB, owner, id);
      if (!current) return json({ error: "Categoria não encontrada." }, 404);
      const references = await categoryReferenceCounts(env.DB, owner, current.name);
      if (Number(references?.referenceCount || 0) > 0) {
        return json({
          error: "Esta categoria está sendo utilizada. Transfira as referências antes de excluí-la.",
          code: "CATEGORY_IN_USE",
          references,
        }, 409);
      }

      const result = await env.DB.prepare(`
        DELETE FROM categories
        WHERE id = ? AND owner = ?
          AND NOT EXISTS (SELECT 1 FROM transactions WHERE owner = ? AND category = ?)
          AND NOT EXISTS (SELECT 1 FROM budgets WHERE owner = ? AND category = ?)
          AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE owner = ? AND category = ?)
        RETURNING id
      `).bind(id, owner, owner, current.name, owner, current.name, owner, current.name).first();
      if (!result) {
        const latestReferences = await categoryReferenceCounts(env.DB, owner, current.name);
        return json({
          error: "Esta categoria passou a ser utilizada e não pode ser excluída sem transferência.",
          code: "CATEGORY_IN_USE",
          references: latestReferences,
        }, 409);
      }
      return json({ deleted: result });
    }
    if (action === "replace_and_delete_category") {
      const id = validId(payload.id);
      const replacementId = validId(payload.replacementId);
      if (!id || !replacementId || id === replacementId) return json({ error: "Selecione outra categoria para a transferência." }, 400);
      const [current, replacement] = await Promise.all([
        categoryById(env.DB, owner, id),
        categoryById(env.DB, owner, replacementId),
      ]);
      if (!current) return json({ error: "Categoria de origem não encontrada." }, 404);
      if (!replacement) return json({ error: "Categoria de destino não encontrada." }, 404);

      await env.DB.batch([
        env.DB.prepare("UPDATE transactions SET category = ?, macro = ? WHERE owner = ? AND category = ?").bind(replacement.name, replacement.macro, owner, current.name),
        env.DB.prepare("UPDATE budgets SET category = ? WHERE owner = ? AND category = ?").bind(replacement.name, owner, current.name),
        env.DB.prepare("UPDATE subscriptions SET category = ? WHERE owner = ? AND category = ?").bind(replacement.name, owner, current.name),
        env.DB.prepare("DELETE FROM categories WHERE id = ? AND owner = ?").bind(id, owner),
      ]);
      return json({ deleted: { id }, replacement });
    }
    if (action === "investment") {
      const result = await env.DB.prepare("INSERT INTO investments (owner, name, type, value, return_pct) VALUES (?, ?, ?, ?, ?) RETURNING id, name, type, value, return_pct AS returnPct").bind(owner, payload.name, payload.type, Number(payload.value), Number(payload.returnPct || 0)).first();
      return json({ item: result }, 201);
    }
    if (action === "update_investment") {
      const result = await env.DB.prepare("UPDATE investments SET name = ?, type = ?, value = ?, return_pct = ? WHERE id = ? AND owner = ? RETURNING id, name, type, value, return_pct AS returnPct").bind(payload.name, payload.type, Number(payload.value), Number(payload.returnPct || 0), Number(payload.id), owner).first();
      if (!result) return json({ error: "Investimento não encontrado" }, 404);
      return json({ item: result });
    }
    if (action === "delete_investment") {
      const result = await env.DB.prepare("DELETE FROM investments WHERE id = ? AND owner = ? RETURNING id").bind(Number(payload.id), owner).first();
      if (!result) return json({ error: "Investimento não encontrado" }, 404);
      return json({ deleted: result });
    }
    if (action === "save_account") {
      const result = await env.DB.prepare("INSERT INTO accounts (owner, name, type, balance, credit_limit, scope, institution, closing_day, due_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, name, type, balance, credit_limit AS creditLimit, scope, institution, closing_day AS closingDay, due_day AS dueDay").bind(owner, payload.name, payload.type, Number(payload.balance || 0), Number(payload.creditLimit || 0), payload.scope || "PF", payload.institution || "", Number(payload.closingDay || 0), Number(payload.dueDay || 0)).first();
      return json({ item: result }, 201);
    }
    if (action === "save_subscription") {
      const selectedCategory = await categoryByName(env.DB, owner, String(payload.category || "").trim());
      if (!selectedCategory) return json({ error: "Selecione uma categoria válida." }, 400);
      const result = await env.DB.prepare("INSERT INTO subscriptions (owner, name, category, account, value, billing_day, status) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, name, category, account, value, billing_day AS billingDay, status").bind(owner, payload.name, selectedCategory.name, payload.account || "Não informado", Number(payload.value), Number(payload.billingDay || 1), "Ativa").first();
      return json({ item: result }, 201);
    }
    if (action === "archive_subscription") {
      const result = await env.DB.prepare("UPDATE subscriptions SET status = 'Inativa' WHERE id = ? AND owner = ? RETURNING id, name, category, account, value, billing_day AS billingDay, status").bind(Number(payload.id), owner).first();
      if (!result) return json({ error: "Assinatura não encontrada" }, 404);
      return json({ item: result });
    }
    if (action === "save_report_note") {
      await env.DB.prepare("DELETE FROM monthly_notes WHERE owner = ? AND month = ?").bind(owner, payload.month).run();
      const result = await env.DB.prepare("INSERT INTO monthly_notes (owner, month, note, updated_at) VALUES (?, ?, ?, ?) RETURNING id, month, note, updated_at AS updatedAt").bind(owner, payload.month, payload.note || "", new Date().toISOString()).first();
      return json({ item: result });
    }
    if (action === "save_settings") {
      const current = normalizeSettings(payload);
      const updatedAt = new Date().toISOString();
      const result = await env.DB.prepare("INSERT INTO user_settings (owner, profile_name, product_name, signature, currency, locale, date_format, theme, density, hide_values, export_identity, export_owner, export_generated_at, export_totals, export_filters, export_freeze_header, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner) DO UPDATE SET profile_name = excluded.profile_name, product_name = excluded.product_name, signature = excluded.signature, currency = excluded.currency, locale = excluded.locale, date_format = excluded.date_format, theme = excluded.theme, density = excluded.density, hide_values = excluded.hide_values, export_identity = excluded.export_identity, export_owner = excluded.export_owner, export_generated_at = excluded.export_generated_at, export_totals = excluded.export_totals, export_filters = excluded.export_filters, export_freeze_header = excluded.export_freeze_header, updated_at = excluded.updated_at RETURNING profile_name AS profileName, product_name AS productName, signature, currency, locale, date_format AS dateFormat, theme, density, hide_values AS hideValues, export_identity AS exportIdentity, export_owner AS exportOwner, export_generated_at AS exportGeneratedAt, export_totals AS exportTotals, export_filters AS exportFilters, export_freeze_header AS exportFreezeHeader, updated_at AS updatedAt").bind(owner, current.profileName, current.productName, current.signature, "BRL", "pt-BR", "DD/MM/AAAA", current.theme, current.density, current.hideValues ? 1 : 0, current.exportIdentity ? 1 : 0, current.exportOwner ? 1 : 0, current.exportGeneratedAt ? 1 : 0, current.exportTotals ? 1 : 0, current.exportFilters ? 1 : 0, current.exportFreezeHeader ? 1 : 0, updatedAt).first<Record<string, unknown>>();
      return json({ item: normalizeSettings(result) });
    }
    if (action === "record_backup") {
      const kind = String(payload.kind || "Exportação").slice(0, 80);
      const result = await env.DB.prepare("INSERT INTO backup_events (owner, kind, created_at) VALUES (?, ?, ?) RETURNING id, kind, created_at AS createdAt").bind(owner, kind, new Date().toISOString()).first();
      return json({ item: result }, 201);
    }
    if (action === "save_budget") {
      const selectedCategory = await categoryByName(env.DB, owner, String(payload.category || "").trim());
      if (!selectedCategory) return json({ error: "Selecione uma categoria válida." }, 400);
      await env.DB.prepare("DELETE FROM budgets WHERE owner = ? AND month = ? AND category = ?").bind(owner, payload.month, selectedCategory.name).run();
      const result = await env.DB.prepare("INSERT INTO budgets (owner, month, category, amount) VALUES (?, ?, ?, ?) RETURNING id, month, category, amount").bind(owner, payload.month, selectedCategory.name, Number(payload.amount)).first();
      return json({ item: result }, 201);
    }
    if (action === "save_goal") {
      const result = await env.DB.prepare("INSERT INTO goals (owner, name, target, current, deadline) VALUES (?, ?, ?, ?, ?) RETURNING id, name, target, current, deadline").bind(owner, payload.name, Number(payload.target), Number(payload.current || 0), payload.deadline).first();
      return json({ item: result }, 201);
    }
    if (action === "save_wealth") {
      const result = await env.DB.prepare("INSERT INTO wealth_items (owner, name, kind, group_name, value, remaining_debt) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, kind, group_name AS 'group', value, remaining_debt AS remainingDebt").bind(owner, payload.name, payload.kind, payload.group, Number(payload.value), Number(payload.remainingDebt || 0)).first();
      return json({ item: result }, 201);
    }
    if (action === "update_wealth") {
      const result = await env.DB.prepare("UPDATE wealth_items SET name = ?, kind = ?, group_name = ?, value = ?, remaining_debt = ? WHERE id = ? AND owner = ? RETURNING id, name, kind, group_name AS 'group', value, remaining_debt AS remainingDebt").bind(payload.name, payload.kind, payload.group, Number(payload.value), Number(payload.remainingDebt || 0), Number(payload.id), owner).first();
      if (!result) return json({ error: "Item patrimonial não encontrado" }, 404);
      return json({ item: result });
    }
    if (action === "delete_planning") {
      const table = String(payload.entity) === "account" ? "accounts" : String(payload.entity) === "budget" ? "budgets" : String(payload.entity) === "goal" ? "goals" : "wealth_items";
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND owner = ?`).bind(Number(payload.id), owner).run();
      return json({ deleted: payload.id });
    }
    if (action === "bulk_import") {
      const rows = Array.isArray(payload.rows) ? payload.rows as Array<Record<string, string | number>> : [];
      if (rows.length > 500) return json({ error: "Limite de 500 linhas por importação" }, 400);
      if (rows.length) await env.DB.batch(rows.map(row => env.DB.prepare("INSERT INTO transactions (owner, date, description, category, macro, type, value, account, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(owner, row.date, row.description, row.category, row.macro, row.type, Number(row.value), row.account || "Não informado", row.recurrence || "Não")));
      return json({ imported: rows.length }, 201);
    }
    return json({ error: "Ação inválida" }, 400);
  }
  return json({ error: "Método não permitido" }, 405);
}

async function backupApi(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Método não permitido" }, 405);
  const owner = ownerOf(request);
  if (!owner) return json({ error: "Acesso protegido. Configure o Cloudflare Access para continuar." }, 401);
  await env.DB.prepare("INSERT INTO backup_events (owner, kind, created_at) VALUES (?, ?, ?)").bind(owner, "Backup JSON", new Date().toISOString()).run();
  const tables = ["categories", "transactions", "investments", "accounts", "budgets", "goals", "wealth_items", "subscriptions", "transaction_events", "monthly_notes", "user_settings", "financial_snapshots", "backup_events"];
  const entries = await Promise.all(tables.map(async table => {
    const result = await env.DB.prepare(`SELECT * FROM ${table} WHERE owner = ?`).bind(owner).all();
    return [table, result.results] as const;
  }));
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, data: Object.fromEntries(entries) }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexo-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

type Summary = { balance: number; savingsRate: number; fixed: number; variable: number; portfolioTotal: number; reserve: number; budgetTotal?: number; projectedExpenses?: number; netWorth?: number; recurringCommitment?: number; alerts?: string[] };

function fallbackAdvice(question: string, summary: Summary) {
  const lower = question.toLowerCase();
  const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  if (lower.includes("gasto") || lower.includes("reduzir")) return `Atue primeiro nos gastos variáveis, hoje em ${brl(summary.variable)}. Defina um teto semanal para lazer e compras e preserve os gastos essenciais.`;
  if (lower.includes("reserva")) {
    if (summary.fixed <= 0) return "Ainda não há gastos fixos suficientes para estimar a cobertura da reserva. Registre os compromissos essenciais para o Nexo calcular a meta de seis meses.";
    return `Sua reserva registrada é ${brl(summary.reserve)}. O próximo marco é ${brl(summary.fixed * 6)}, equivalente a seis meses dos compromissos fixos.`;
  }
  if (lower.includes("invest")) return `Você tem ${brl(summary.portfolioTotal)} investidos. Preserve liquidez para a reserva e só aumente risco depois de definir objetivo e prazo para cada aporte.`;
  const budgetNote = summary.budgetTotal ? ` O orçamento do mês é ${brl(summary.budgetTotal)} e a projeção de saídas é ${brl(summary.projectedExpenses || 0)}.` : "";
  const alertNote = summary.alerts?.length ? ` Ponto de atenção: ${summary.alerts[0]}` : "";
  return `Seu saldo mensal é ${brl(summary.balance)} e sua taxa de poupança é ${summary.savingsRate.toFixed(1)}%.${budgetNote}${alertNote} Priorize a reserva de emergência e revise os gastos variáveis semanalmente.`;
}

async function advisorApi(request: Request, env: Env) {
  if (request.method !== "POST") return json({ error: "Método não permitido" }, 405);
  const { question, summary } = await request.json() as { question?: string; summary?: Summary };
  if (!question?.trim() || !summary) return json({ error: "Pergunta e resumo são obrigatórios" }, 400);
  if (!env.OPENAI_API_KEY) return json({ answer: fallbackAdvice(question, summary), mode: "local" });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-5.6", store: false, instructions: "Você é um consultor de finanças pessoais. Responda em português do Brasil, de forma direta e prática, em até 120 palavras. Analise somente os números fornecidos. Não prometa retornos, não prescreva produtos específicos e destaque quando algo depender de perfil de risco.", input: `Resumo financeiro: ${JSON.stringify(summary)}\nPergunta: ${question}` }),
    });
    if (!response.ok) throw new Error("OpenAI indisponível");
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const answer = data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    if (!answer) throw new Error("Resposta vazia");
    return json({ answer, mode: "chatgpt" });
  } catch {
    return json({ answer: fallbackAdvice(question, summary), mode: "local" });
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/finance") {
      try { return await financeApi(request, env); } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha nos dados" }, 500); }
    }

    if (url.pathname === "/api/advisor") {
      try { return await advisorApi(request, env); } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha na análise" }, 500); }
    }

    if (url.pathname === "/api/backup") {
      try { return await backupApi(request, env); } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha no backup" }, 500); }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
