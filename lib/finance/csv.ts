/** Prevent spreadsheet formula execution while preserving numeric columns. */
export function csvCell(value: string | number) {
  const text = String(value);
  const safe = typeof value === 'string' && /^[\s]*[=+@\-\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}
