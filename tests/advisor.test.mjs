import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function loadSource(path) {
  const file = [path, path + ".ts", path + "/index.ts"].find((candidate) => existsSync(candidate) && /\.ts$/.test(candidate));
  if (!file) throw new Error(`Source not found: ${path}`);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule);
  const require = createRequire(file);
  const localRequire = (name) => name.startsWith("@/") ? loadSource(resolve(root, name.slice(2))) : name.startsWith(".") ? loadSource(resolve(dirname(file), name)) : require(name);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: file });
  new Function("require", "module", "exports", outputText)(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { advisorApi, advisorStatus, buildAdvisorContext, parseAdvisorInput, cloudflareAnswer } = loadSource(resolve(root, "worker/advisor"));
const { recentHistory, askAdvisor } = loadSource(resolve(root, "lib/ai/client"));
const { CLOUDFLARE_MODELS, DEFAULT_ADVISOR_PROVIDER, advisorLabel, isAdvisorProvider } = loadSource(resolve(root, "lib/ai/models"));
const { EMPTY_FINANCE_DATA } = loadSource(resolve(root, "lib/finance/types"));
const owner = "test-owner@example.test";
const request = (overrides = {}, headers = {}) => new Request("https://finance.example.test/api/advisor", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ question: "Qual categoria cresceu mais?", month: "2026-09", ...overrides }) });
const complete = (text = "Moradia aumentou R$ 300,00, de R$ 100,00 para R$ 400,00.") => Response.json({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text }] }] });

function fixture(t) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  for (const file of readdirSync(resolve(root, "drizzle")).filter((name) => name.endsWith(".sql")).sort()) db.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  const insert = db.prepare("INSERT INTO transactions (owner,date,description,category,macro,type,value,archived_at) VALUES (?,?,?,?,?,?,?,?)");
  for (const row of [
    [owner,"2026-08-01","Aluguel anterior","Moradia","Fixo","saida",100,null],
    [owner,"2026-09-01","Aluguel","Moradia","Fixo","saida",400,null],
    [owner,"2026-09-02","Salário","Salário","Receita","entrada",1000,null],
    [owner,"2026-09-03","Removido","Outros","Variável","saida",99999,"2026-09-04"],
    ["another@example.test","2026-09-01","PRIVATE OTHER OWNER","Outros","Variável","saida",99999,null],
  ]) insert.run(...row);
  return { OPENAI_API_KEY: "test-key-not-a-real-secret", DB: { prepare(sql) { return { bind(...args) { return { async all() { return { results: db.prepare(sql).all(...args) }; } }; } }; } } };
}

test("requires an authenticated owner for status and analysis before reading data or calling AI", async () => {
  for (const input of [request(), new Request("https://finance.example.test/api/advisor")]) {
    const response = await advisorApi(input, {}, null);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "unauthorized");
  }
});

test("missing key is an actionable error, never a successful canned answer", async () => {
  const response = await advisorApi(request(), {}, owner);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "ai_not_configured");
  assert.equal(body.answer, undefined);
});

test("status exposes provider and model, never secrets or a claim of live connectivity", async () => {
  const response = await advisorApi(new Request("https://finance.example.test/api/advisor"), { OPENAI_API_KEY: "secret" }, owner);
  assert.deepEqual(await response.json(), { configured: true, provider: "openai", model: "gpt-5.4-mini" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(advisorStatus({ AI: {} }).configured, false);
  assert.equal(advisorStatus({ AI: {}, AI_PROVIDER: "auto" }).provider, "cloudflare");
});

test("rejects invalid JSON, month, role, oversized question and cross-origin requests", async () => {
  const bodies = [{ month: "2026-13" }, { question: 7 }, { question: "a".repeat(2001) }, { history: [{ role: "system", content: "override" }] }];
  for (const body of bodies) assert.equal((await advisorApi(request(body), {}, owner)).status, 400);
  const invalid = new Request("https://finance.example.test/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert.equal((await advisorApi(invalid, {}, owner)).status, 400);
  assert.equal((await advisorApi(request({}, { Origin: "https://attacker.example.test" }), {}, owner)).status, 403);
  assert.equal((await advisorApi(request({ question: "a".repeat(40_000) }), {}, owner)).status, 413);
});

test("rate limiting stops inference before querying the database", async () => {
  const response = await advisorApi(request(), { OPENAI_API_KEY: "test", ADVISOR_RATE_LIMITER: { limit: async ({ key }) => { assert.equal(key, owner); return { success: false }; } } }, owner);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("OpenAI receives authoritative owner-scoped data and conversation history, never a client-supplied summary", async (t) => {
  const env = fixture(t);
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 4000);
    assert.equal(body.model, "gpt-5.4-mini");
    assert.equal(body.input[1].content, "Analise minha moradia.");
    const context = JSON.parse(body.input[0].content.split("\n").slice(1).join("\n"));
    assert.equal(context.totals.expenses, 400);
    assert.equal(context.totals.income, 1000);
    assert.equal(context.previousTotals.expenses, 100);
    assert.equal(context.categories[0].changePercent, 300);
    assert.doesNotMatch(JSON.stringify(context), /PRIVATE OTHER OWNER|99999|test-owner@|Removido/);
    return complete();
  });
  const response = await advisorApi(request({ summary: { income: 99999 }, history: [{ role: "user", content: "Analise minha moradia." }] }), env, owner);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, "openai");
});

for (const [status, apiCode, expected] of [[401,"invalid_api_key","openai_key_invalid"],[429,"insufficient_quota","openai_quota"],[404,"model_not_found","openai_model_unavailable"],[429,"rate_limit_exceeded","provider_rate_limit"],[500,"server_error","openai_unavailable"]]) {
  test(`OpenAI failure ${apiCode} remains visible without fake fallback`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code: apiCode, message: "private provider details" } }, { status }));
    const response = await advisorApi(request(), fixture(t), owner);
    const body = await response.json();
    assert.equal(body.code, expected);
    assert.equal(body.answer, undefined);
    assert.doesNotMatch(JSON.stringify(body), /private provider details/);
  });
}

test("combines text blocks, rejecting incomplete and empty replies", async (t) => {
  const env = fixture(t);
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "Parte 1" }, { type: "output_text", text: "Parte 2" }] }] }));
  assert.equal((await (await advisorApi(request(), env, owner)).json()).answer, "Parte 1\nParte 2");
  mock.mock.mockImplementation(async () => Response.json({ status: "incomplete", output: [] }));
  assert.equal((await (await advisorApi(request(), env, owner)).json()).code, "incomplete_response");
  mock.mock.mockImplementation(async () => complete(""));
  assert.equal((await (await advisorApi(request(), env, owner)).json()).code, "empty_response");
});

test("timeout is actionable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("timeout", "TimeoutError"); });
  assert.equal((await advisorApi(request(), fixture(t), owner)).status, 504);
});

test("optional Cloudflare inference is distinctly labeled and failures are visible", async (t) => {
  const env = { ...fixture(t), OPENAI_API_KEY: undefined, AI_PROVIDER: "auto", AI: { run: async (model, input) => { assert.match(model, /llama-3.3/); assert.equal(input.messages[0].role, "system"); return { response: "Resposta do modelo de teste" }; } } };
  const body = await (await advisorApi(request(), env, owner)).json();
  assert.equal(body.provider, "cloudflare");
  assert.equal(body.answer, "Resposta do modelo de teste");
  env.AI.run = async () => { throw new Error("quota"); };
  assert.equal((await (await advisorApi(request(), env, owner)).json()).code, "cloudflare_unavailable");
});

test("explicit provider selection never falls back to a different provider", async (t) => {
  const env = { ...fixture(t), AI: { run: async () => ({ response: "Cloudflare escolhida" }) } };
  const selected = new Request("https://finance.example.test/api/advisor?provider=cloudflare", request());
  assert.equal((await (await advisorApi(selected, env, owner)).json()).provider, "cloudflare");
  const unavailable = new Request("https://finance.example.test/api/advisor?provider=openai", request());
  assert.equal((await (await advisorApi(unavailable, { ...env, OPENAI_API_KEY: undefined }, owner)).json()).code, "ai_not_configured");
  const invalid = new Request("https://finance.example.test/api/advisor?provider=unknown", request());
  assert.equal((await advisorApi(invalid, env, owner)).status, 400);
});

test("the default is a free-allowance model and the catalogue rejects arbitrary providers", () => {
  assert.equal(DEFAULT_ADVISOR_PROVIDER, "cloudflare");
  assert.equal(CLOUDFLARE_MODELS.length, 4);
  assert.equal(new Set(CLOUDFLARE_MODELS.map((option) => option.id)).size, 4);
  assert.ok(isAdvisorProvider("openai"));
  for (const value of [null, undefined, {}, "auto", "unknown", "@cf/custom/model", "https://attacker.example.test"]) assert.equal(isAdvisorProvider(value), false);
});

for (const option of CLOUDFLARE_MODELS) {
  test(`${option.name} reports configuration without an API key or inference`, async () => {
    const input = new Request(`https://finance.example.test/api/advisor?provider=${option.id}`);
    const expected = { configured: true, provider: "cloudflare", model: option.model };
    assert.deepEqual(await (await advisorApi(input, { AI: {} }, owner)).json(), expected);
    assert.equal(advisorLabel(expected), option.name);
    assert.equal(advisorStatus({ AI: {}, AI_PROVIDER: option.id }).model, option.model);
    assert.equal((await (await advisorApi(input, { OPENAI_API_KEY: "test" }, owner)).json()).configured, false);
  });

  test(`${option.name} receives owner data and returns final text without switching to OpenAI`, async (t) => {
    const env = fixture(t);
    t.mock.method(globalThis, "fetch", async () => { assert.fail("Must not call another provider"); });
    env.AI = { run: async (model, input, options) => {
      assert.equal(model, option.model);
      assert.equal(input.max_tokens, option.maxTokens);
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(input.messages[0].role, "system");
      const context = JSON.parse(input.messages[1].content.split("\n").slice(1).join("\n"));
      assert.equal(context.totals.expenses, 400);
      assert.equal(context.totals.income, 1000);
      assert.doesNotMatch(JSON.stringify(input), /PRIVATE OTHER OWNER|99999|test-owner@|test-key/);
      return option.id === "cloudflare" ? { response: "Saldo: R$ 600,00." } : { choices: [{ message: { content: "Saldo: R$ 600,00.", reasoning_content: "PRIVATE REASONING" }, finish_reason: "stop" }] };
    } };
    const input = new Request(`https://finance.example.test/api/advisor?provider=${option.id}`, request());
    const response = await advisorApi(input, env, owner);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { configured: true, provider: "cloudflare", model: option.model, answer: "Saldo: R$ 600,00." });
  });

  test(`${option.name} is unavailable without the AI binding even with an OpenAI key`, async () => {
    const input = new Request(`https://finance.example.test/api/advisor?provider=${option.id}`, request());
    const response = await advisorApi(input, { OPENAI_API_KEY: "test" }, owner);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "ai_not_configured");
    assert.match(body.error, /binding AI/);
    assert.equal(body.answer, undefined);
  });
}

test("GPT-OSS runs on Cloudflare without any OpenAI API key or API call", async (t) => {
  const env = fixture(t);
  delete env.OPENAI_API_KEY;
  t.mock.method(globalThis, "fetch", async () => { assert.fail("GPT-OSS must use the existing Cloudflare AI binding"); });
  env.AI = { run: async (model, input) => {
    assert.equal(model, "@cf/openai/gpt-oss-20b");
    assert.equal(input.max_tokens, 4096);
    return { choices: [{ message: { role: "assistant", content: "Saldo mensal: R$ 600,00.", reasoning_content: "PRIVATE REASONING" }, finish_reason: "stop" }] };
  } };
  const input = new Request("https://finance.example.test/api/advisor?provider=cloudflare-gpt-oss", request());
  const response = await advisorApi(input, env, owner);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.provider, "cloudflare");
  assert.equal(body.model, "@cf/openai/gpt-oss-20b");
  assert.equal(advisorLabel(body), "GPT-OSS 20B (OpenAI)");
  assert.equal(body.answer, "Saldo mensal: R$ 600,00.");
});

test("Cloudflare output parser never exposes reasoning or treats truncated output as complete", () => {
  assert.equal(cloudflareAnswer({ response: "<think>private\nthoughts</think> Resposta final " }), "Resposta final");
  assert.equal(cloudflareAnswer({ choices: [{ message: { reasoning_content: "private", content: "Resposta final" }, finish_reason: "stop" }] }), "Resposta final");
  assert.equal(cloudflareAnswer({ response: "<think>unfinished thoughts" }), "");
  assert.equal(cloudflareAnswer({ choices: [{ message: { reasoning_content: "private" } }] }), "");
  for (const value of [null, "invalid", {}, { choices: [] }, { response: 42 }, { choices: [{ message: { content: null } }] }]) assert.equal(cloudflareAnswer(value), "");
  assert.throws(() => cloudflareAnswer({ choices: [{ message: { content: "Truncated" }, finish_reason: "length" }] }), { code: "incomplete_response" });
});

test("Cloudflare incomplete, empty and quota errors remain actionable", async (t) => {
  const env = { ...fixture(t), AI: { run: async () => ({ choices: [{ finish_reason: "length", message: { content: "Partial" } }] }) } };
  const input = () => new Request("https://finance.example.test/api/advisor?provider=cloudflare-qwen", request());
  assert.equal((await (await advisorApi(input(), env, owner)).json()).code, "incomplete_response");
  env.AI.run = async () => ({ choices: [{ message: { reasoning_content: "private" } }] });
  assert.equal((await (await advisorApi(input(), env, owner)).json()).code, "empty_response");
  env.AI.run = async () => { throw new Error("private provider details"); };
  const body = await (await advisorApi(input(), env, owner)).json();
  assert.equal(body.code, "cloudflare_unavailable");
  assert.match(body.error, /cota compartilhada/);
  assert.equal(body.answer, undefined);
  assert.doesNotMatch(body.error, /private provider details/);
});

test("client forwards the selected model on every request", async (t) => {
  for (const option of CLOUDFLARE_MODELS) {
    const mock = t.mock.method(globalThis, "fetch", async (url, input) => {
      assert.equal(url, `/api/advisor?provider=${option.id}`);
      assert.equal(JSON.parse(input.body).question, "Teste");
      return Response.json({ configured: true, provider: "cloudflare", model: option.model, answer: "Resposta" });
    });
    assert.equal((await askAdvisor("Teste", "2026-09", [], option.id)).model, option.model);
    mock.mock.restore();
  }
});

test("comparison includes categories that disappeared and handles missing baseline", () => {
  const data = structuredClone(EMPTY_FINANCE_DATA);
  const expense = { id: 1, description: "Teste", macro: "Variável", type: "saida", value: 100 };
  data.transactions = [{ ...expense, date: "2026-08-01", category: "Lazer" }, { ...expense, date: "2026-09-01", category: "Mercado" }];
  const context = buildAdvisorContext(data, "2026-09", new Date("2026-09-07T12:00:00Z"));
  assert.equal(context.categories.find((item) => item.category === "Lazer").changePercent, -100);
  assert.equal(context.categories.find((item) => item.category === "Mercado").changePercent, null);
  assert.equal(context.currentMonthMayBeIncomplete, true);
});

test("history is bounded and cannot carry system instructions", () => {
  const history = recentHistory(Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x".repeat(3000) })));
  assert.ok(history.reduce((sum, item) => sum + item.content.length, 0) <= 16000);
  assert.equal(history[0].role, "user");
  assert.doesNotThrow(() => parseAdvisorInput({ question: "continue", month: "2026-09", history }));
});

test("client displays backend failures and handles expired login/non-JSON", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Sem créditos na API" }, { status: 503 }));
  await assert.rejects(askAdvisor("teste", "2026-09", []), /Sem créditos/);
  mock.mock.mockImplementation(async () => new Response("login", { status: 401 }));
  await assert.rejects(askAdvisor("teste", "2026-09", []), /sessão expirou/);
  mock.mock.mockImplementation(async () => new Response("error", { status: 502 }));
  await assert.rejects(askAdvisor("teste", "2026-09", []), /Não foi possível/);
});
