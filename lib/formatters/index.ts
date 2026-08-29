const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatCurrency(value: number) {
  return brl.format(Number.isFinite(value) ? value : 0);
}

export function formatPrivateCurrency(value: number, hidden = false) {
  return hidden ? "R$ ••••••" : formatCurrency(value);
}

export function formatPercent(value: number, suffix = true) {
  const formatted = percent.format(Number.isFinite(value) ? value : 0);
  return suffix ? `${formatted}%` : formatted;
}

export function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) return "Período atual";
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));
}

export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function currentMonthKey(date = new Date()) {
  return localIsoDate(date).slice(0, 7);
}

export function fileTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
