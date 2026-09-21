import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

export const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
export function loadSource(path) {
  const file = [path, path + '.ts', path + '.tsx', path + '/index.ts'].find(p => existsSync(p) && /\.tsx?$/.test(p));
  if (!file) throw new Error('Source not found: ' + path);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} }; cache.set(file, compiledModule);
  const require = createRequire(file);
  const localRequire = name => name.startsWith('@/') ? loadSource(resolve(root,name.slice(2))) : name.startsWith('.') ? loadSource(resolve(dirname(file),name)) : require(name);
  const { outputText } = ts.transpileModule(readFileSync(file,'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:file });
  new Function('require','module','exports',outputText)(localRequire,compiledModule,compiledModule.exports);
  return compiledModule.exports;
}

export function database(t, path = ':memory:') {
  const db = new DatabaseSync(path); t.after(()=>db.close());
  for(const file of readdirSync(resolve(root,'drizzle')).filter(p=>p.endsWith('.sql')).sort()) db.exec(readFileSync(resolve(root,'drizzle',file),'utf8'));
  const prepare = (sql, args=[]) => ({
    bind(...values) { return prepare(sql,values); },
    async all() { return { results:db.prepare(sql).all(...args),success:true }; },
    async first() { return db.prepare(sql).get(...args) || null; },
    async run() { return { meta:db.prepare(sql).run(...args),success:true }; },
  });
  const DB = { prepare, async batch(statements) {
    db.exec('BEGIN');
    try { const results=[]; for(const statement of statements) results.push(await statement.all()); db.exec('COMMIT'); return results; }
    catch(error) { db.exec('ROLLBACK'); throw error; }
  } };
  return { db, DB };
}
