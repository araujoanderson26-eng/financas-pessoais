import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Compile the actual TS/TSX sources with the project's existing compiler.
// No browser, runtime loader or additional test dependency is required.
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function loadSource(path) {
  const file = [path, path + ".ts", path + ".tsx", path + "/index.ts", path + "/index.tsx"].find((candidate) => existsSync(candidate) && /\.tsx?$/.test(candidate));
  if (!file) throw new Error(`Source not found: ${path}`);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule);
  const require = createRequire(file);
  const localRequire = (name) => name.startsWith("@/") ? loadSource(resolve(root, name.slice(2))) : name.startsWith(".") ? loadSource(resolve(dirname(file), name)) : require(name);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: file,
  });
  new Function("require", "module", "exports", outputText)(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { getFinancialAnalytics } = loadSource(resolve(root, "lib/finance/analytics"));
const { EMPTY_FINANCE_DATA } = loadSource(resolve(root, "lib/finance/types"));
const { AlertsButton } = loadSource(resolve(root, "components/layout/AlertsButton"));
const today = new Date(2026, 8, 15, 12);
const month = "2026-09";
const data = () => structuredClone(EMPTY_FINANCE_DATA);
const expense = { id: 1, date: "2026-09-01", description: "Conta de teste", category: "Moradia", macro: "Fixo", type: "saida", value: 100 };
const titles = (fixture, selected = month) => getFinancialAnalytics(fixture, selected, today).alerts.map((alert) => alert.title);
const render = (fixture, syncState = "saved") => renderToStaticMarkup(createElement(AlertsButton, { alerts: getFinancialAnalytics(fixture, month, today).alerts, selectedMonth: month, syncState }));
const badge = (html) => html.match(/<span>(\d+)<\/span>/)?.[1] ?? null;

test("A/C: two active conditions produce badge 2 and their full messages", () => {
  const fixture = data();
  fixture.transactions.push(expense);
  assert.deepEqual(titles(fixture), ["Reserva em formação", "Planejamento de objetivos"]);
  const html = render(fixture);
  assert.equal(badge(html), "2");
  assert.match(html, /A cobertura atual é de 0.0 meses de gastos fixos/);
  assert.match(html, /Cadastre uma meta financeira para acompanhar aportes e prazo/);
  assert.equal((html.match(/<li>/g) || []).length, 2);
  assert.match(html, /popover="auto"/);
  assert.match(html, /popovertarget=/i);
  assert.match(html, /aria-expanded="false"/);
});

test("F: resolving existing conditions updates the badge from 2 to 1 to zero", () => {
  const fixture = data();
  fixture.transactions.push(expense);
  assert.equal(badge(render(fixture)), "2");
  fixture.goals.push({ id: 1, name: "Meta de teste", target: 1000, current: 0, deadline: "2027-01-01" });
  assert.equal(badge(render(fixture)), "1");
  fixture.investments.push({ id: 1, name: "Reserva", type: "CDB", value: 600, returnPct: 0 });
  assert.equal(badge(render(fixture)), null);
  assert.match(render(fixture), /Nenhum alerta financeiro pendente/);
});

test("all five existing rules, levels and selected-month conditions are preserved", () => {
  const fixture = data();
  fixture.transactions.push(expense, { ...expense, id: 2, type: "entrada", macro: "Receita", value: 150 });
  fixture.budgets.push({ id: 1, month, category: "Moradia", amount: 50 });
  const alerts = getFinancialAnalytics(fixture, month, today).alerts;
  assert.deepEqual(alerts.map(({ level }) => level), ["important", "attention", "important", "info", "info"]);
  assert.equal(badge(render(fixture)), "5");
  assert.equal((render(fixture).match(/<li>/g) || []).length, 5);
  assert.deepEqual(titles(fixture, "2026-08"), ["Planejamento de objetivos"]);
});

test("budget, fixed-expense and reserve thresholds retain their existing boundaries", () => {
  const fixture = data();
  fixture.transactions.push({ ...expense, value: 60 }, { ...expense, id: 2, type: "entrada", macro: "Receita", value: 100 });
  fixture.budgets.push({ id: 1, month, category: "Moradia", amount: 60 });
  fixture.investments.push({ id: 1, name: "Reserva", type: "CDB", value: 360, returnPct: 0 });
  assert.deepEqual(getFinancialAnalytics(fixture, month, new Date(2026, 8, 30, 12)).alerts.map(({ title }) => title), ["Planejamento de objetivos"]);
});

test("unloaded or unavailable data never generates a misleading pending badge", () => {
  for (const state of ["loading", "error", "local"]) {
    const html = render(data(), state);
    assert.equal(badge(html), null);
    assert.doesNotMatch(html, /Planejamento de objetivos/);
    assert.match(html, /role="status"/);
  }
  assert.equal(badge(render(data(), "saving")), "1");
});

test("G: alerts are recomputed from the same persisted data without read-state mutation", () => {
  const fixture = data();
  fixture.transactions.push(expense);
  const serialized = JSON.stringify(fixture);
  assert.deepEqual(titles(JSON.parse(serialized)), titles(fixture));
  render(fixture);
  assert.equal(JSON.stringify(fixture), serialized);
});
