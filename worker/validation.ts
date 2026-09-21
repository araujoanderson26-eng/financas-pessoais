import { ApiError } from './http';

type Payload = Record<string, unknown>;
const invalid = (key: string): never => { throw new ApiError(`Campo inválido: ${key}.`); };
function text(p: Payload, key: string, max = 180, optional = false) {
  if (optional && (p[key] === undefined || p[key] === '')) return;
  if (typeof p[key] !== 'string' || !(p[key] as string).trim() || (p[key] as string).length > max) invalid(key);
  p[key] = (p[key] as string).trim();
}
function number(p: Payload, key: string, min = 0, max = 1e12, fallback?: number, integer = false) {
  const raw = p[key] ?? fallback;
  if (!['number', 'string'].includes(typeof raw) || raw === '') invalid(key);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid(key);
  if (!integer && key !== 'returnPct' && Math.abs(value * 100 - Math.round(value * 100)) > 0.001) invalid(key);
  p[key] = value;
}
function choice(p: Payload, key: string, values: string[], fallback?: string) {
  p[key] ??= fallback;
  if (typeof p[key] !== 'string' || !values.includes(p[key] as string)) invalid(key);
}
function date(p: Payload, key: string) {
  const value = p[key];
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') invalid(key);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(key);
}
function transaction(p: Payload, descriptionLimit = 200) {
  date(p, 'date'); text(p, 'description', descriptionLimit); text(p, 'category'); number(p, 'value', 0.01);
  choice(p, 'type', ['entrada', 'saida']);
  choice(p, 'recurrence', ['Não', 'Mensal', 'Anual', 'Personalizada'], 'Não');
  text(p, 'account', 180, true);
}
export function validateAction(p: Payload): Payload {
  text(p, 'action', 50);
  const action = String(p.action);
  if (action.startsWith('update_') || action.startsWith('delete_') || ['archive_subscription', 'replace_and_delete_category'].includes(action)) number(p, 'id', 1, Number.MAX_SAFE_INTEGER, undefined, true);
  switch (action) {
    case 'transaction': case 'update_transaction':
      // Creation adds an installment suffix; edits/imports must accept stored descriptions.
      transaction(p, action === 'transaction' ? 180 : 200);
      if (action === 'transaction') { number(p, 'installmentTotal', 1, 120, 1, true); if (Math.round(Number(p.value) * 100) < Number(p.installmentTotal)) invalid('installmentTotal'); }
      break;
    case 'category': case 'update_category': text(p, 'name'); choice(p, 'macro', ['Fixo', 'Variável', 'Receita']); break;
    case 'replace_and_delete_category': number(p, 'replacementId', 1, Number.MAX_SAFE_INTEGER, undefined, true); break;
    case 'investment': case 'update_investment': text(p, 'name'); text(p, 'type', 100); number(p, 'value', 0.01); number(p, 'returnPct', -100, 1e6, 0); break;
    case 'save_account':
      text(p, 'name'); text(p, 'institution', 180, true); choice(p, 'type', ['Conta corrente', 'Conta poupança', 'Carteira', 'Dinheiro', 'Cartão de crédito']); choice(p, 'scope', ['PF', 'PJ'], 'PF');
      number(p, 'balance', -1e12, 1e12, 0); number(p, 'creditLimit', 0, 1e12, 0);
      number(p, 'closingDay', p.type === 'Cartão de crédito' ? 1 : 0, 31, 0, true); number(p, 'dueDay', p.type === 'Cartão de crédito' ? 1 : 0, 31, 0, true); break;
    case 'save_subscription': text(p, 'name'); text(p, 'category'); text(p, 'account', 180, true); number(p, 'value', 0.01); number(p, 'billingDay', 1, 31, 1, true); break;
    case 'save_budget': case 'save_report_note':
      if (typeof p.month !== 'string' || !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(p.month)) invalid('month');
      if (action === 'save_budget') { text(p, 'category'); number(p, 'amount', 0.01); }
      else if (typeof p.note !== 'string' || p.note.length > 10000) invalid('note');
      break;
    case 'save_goal': text(p, 'name'); number(p, 'target', 0.01); number(p, 'current', 0, 1e12, 0); date(p, 'deadline'); break;
    case 'save_wealth': case 'update_wealth': text(p, 'name'); text(p, 'group'); choice(p, 'kind', ['Ativo', 'Passivo']); number(p, 'value'); number(p, 'remainingDebt', 0, 1e12, 0); break;
    case 'delete_planning': choice(p, 'entity', ['account', 'budget', 'goal', 'wealth']); break;
    case 'save_settings':
      for (const key of ['profileName', 'productName', 'signature']) if (p[key] !== undefined) text(p, key);
      for (const key of ['hideValues', 'exportIdentity', 'exportOwner', 'exportGeneratedAt', 'exportTotals', 'exportFilters', 'exportFreezeHeader']) if (p[key] !== undefined && typeof p[key] !== 'boolean') invalid(key);
      if (p.theme !== undefined) choice(p, 'theme', ['light', 'dark', 'system']);
      if (p.density !== undefined) choice(p, 'density', ['comfortable', 'compact']);
      break;
    case 'record_backup': text(p, 'kind', 80); break;
    case 'bulk_import':
      if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 500) invalid('rows (1 a 500 linhas)');
      for (const row of p.rows as unknown[]) { if (!row || typeof row !== 'object' || Array.isArray(row)) invalid('rows'); transaction(row as Payload); }
      break;
    case 'delete_transaction': case 'delete_category': case 'delete_investment': case 'archive_subscription': break;
    default: throw new ApiError('Ação inválida.');
  }
  return p;
}

export function installments(date: string, value: number, count: number) {
  const base = new Date(`${date}T12:00:00Z`);
  const cents = Math.round(value * 100);
  const each = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(base); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + index);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(base.getUTCDate(), lastDay));
    return { date: next.toISOString().slice(0, 10), value: (each + (index < cents % count ? 1 : 0)) / 100 };
  });
}
