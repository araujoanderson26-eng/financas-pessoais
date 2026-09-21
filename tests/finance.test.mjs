import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { database, loadSource, root } from './helpers.mjs';
const {financeApi,backupApi}=loadSource(resolve(root,'worker/finance'));
const {apiFailure}=loadSource(resolve(root,'worker/http'));
const {getFinancialAnalytics}=loadSource(resolve(root,'lib/finance/analytics'));
const {EMPTY_FINANCE_DATA}=loadSource(resolve(root,'lib/finance/types'));
const {csvCell}=loadSource(resolve(root,'lib/finance/csv'));
const owner='test@example.test';
async function call(env, payload, who=owner, headers={}) {
  try { return await financeApi(new Request('https://finance.test/api/finance',payload ? {method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(payload)} : {}), env, who); }
  catch(error) { return apiFailure(error); }
}
const expense={action:'transaction',description:'Mercado',date:'2026-01-31',category:'Alimentação',type:'saida',value:100,installmentTotal:3};
async function fixture(t) { const env=database(t); assert.equal((await call(env)).status,200); return env; }

test('initialization is idempotent and owner scoped',async t=>{
  const env=await fixture(t); await Promise.all([call(env),call(env)]);
  assert.equal(env.db.prepare('SELECT count(*) n FROM categories WHERE owner=?').get(owner).n,9);
  assert.equal((await (await call(env)).json()).transactions.length,0);
  await call(env,{action:'investment',name:'Privado',type:'CDB',value:20});
  assert.equal((await (await call(env,null,'other@test')).json()).investments.length,0);
});
test('installments preserve cents, clamp month-end, and audit atomically',async t=>{
  const env=await fixture(t); const result=await call(env,expense); assert.equal(result.status,201);
  const {items}=await result.json(); assert.deepEqual(items.map(r=>r.date),['2026-01-31','2026-02-28','2026-03-31']);
  assert.equal(items.reduce((sum,r)=>sum+Math.round(r.value*100),0),10000);
  assert.equal(env.db.prepare('SELECT count(*) n FROM transaction_events').get().n,3);
  env.db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON transaction_events BEGIN SELECT RAISE(ABORT,'test failure'); END;");
  assert.equal((await call(env,{...expense,description:'Rollback'})).status,500);
  assert.equal(env.db.prepare('SELECT count(*) n FROM transactions').get().n,3);
});
test('invalid amounts, dates, fractions, enums and content are rejected before writing',async t=>{
  const env=await fixture(t);
  for(const patch of [{installmentTotal:2.5},{value:-1},{value:'NaN'},{value:0.01,installmentTotal:3},{date:'2026-02-31'},{type:'bad'},{description:''},{value:1.001}]) assert.equal((await call(env,{...expense,...patch})).status,400,JSON.stringify(patch));
  assert.equal((await call(env,expense,owner,{Origin:'https://evil.test'})).status,403);
  assert.equal((await call(env,expense,owner,{'Content-Type':'text/plain'})).status,415);
  assert.equal(env.db.prepare('SELECT count(*) n FROM transactions').get().n,0);
});
test('budgets and notes update in place; invalid replacement preserves originals',async t=>{
  const env=await fixture(t); const budget={action:'save_budget',month:'2026-09',category:'Moradia',amount:100};
  const a=await(await call(env,budget)).json(); assert.equal((await call(env,{...budget,amount:'bad'})).status,400);
  const b=await(await call(env,{...budget,amount:250})).json(); assert.equal(a.item.id,b.item.id); assert.equal(b.item.amount,250);
  const note={action:'save_report_note',month:'2026-09',note:'Primeira'};
  const n1=await(await call(env,note)).json(); const n2=await(await call(env,{...note,note:'Segunda'})).json(); assert.equal(n1.item.id,n2.item.id);
  assert.equal((await call(env,{...note,note:null})).status,400);
  assert.equal(env.db.prepare('SELECT note FROM monthly_notes').get().note,'Segunda');
});
test('CRUD, archive, references and missing IDs have truthful outcomes',async t=>{
  const env=await fixture(t); const created=await(await call(env,{...expense,installmentTotal:1})).json();
  assert.equal((await call(env,{...expense,action:'update_transaction',id:created.item.id,value:90})).status,200);
  const category=env.db.prepare("SELECT id FROM categories WHERE name='Alimentação'").get();
  assert.equal((await call(env,{action:'delete_category',id:category.id})).status,409);
  assert.equal((await call(env,{action:'delete_transaction',id:created.item.id},'other@test')).status,404);
  assert.equal((await call(env,{action:'delete_transaction',id:created.item.id})).status,200);
  assert.equal((await(await call(env)).json()).transactions.length,0);
  assert.equal(env.db.prepare('SELECT count(*) n FROM transactions').get().n,1);
  assert.equal((await call(env,{action:'delete_planning',entity:'unknown',id:999})).status,400);
  assert.equal((await call(env,{action:'delete_planning',entity:'wealth',id:999})).status,404);
});
test('category merge cannot corrupt overlapping budgets; import is atomic and canonical',async t=>{
  const env=await fixture(t);
  for(const category of ['Moradia','Lazer']) await call(env,{action:'save_budget',month:'2026-09',category,amount:100});
  const categories=env.db.prepare("SELECT id FROM categories WHERE name IN ('Moradia','Lazer') ORDER BY name").all();
  assert.equal((await call(env,{action:'replace_and_delete_category',id:categories[0].id,replacementId:categories[1].id})).status,409);
  assert.equal(env.db.prepare('SELECT sum(amount) n FROM budgets').get().n,200);
  assert.equal((await call(env,{action:'bulk_import',rows:[expense,{...expense,category:'Invalid'}]})).status,400);
  assert.equal(env.db.prepare('SELECT count(*) n FROM transactions').get().n,0);
  assert.equal((await call(env,{action:'bulk_import',rows:[{...expense,macro:'fake'}]})).status,201);
  assert.equal(env.db.prepare('SELECT macro FROM transactions').get().macro,'Variável');
});
test('backup includes archived data, audit and settings without other owners',async t=>{
  const env=await fixture(t); const item=await(await call(env,{...expense,installmentTotal:1})).json();
  await call(env,{action:'delete_transaction',id:item.item.id}); await call(env,{action:'investment',name:'OTHER_PRIVATE',type:'CDB',value:10},'other@test');
  const response=await backupApi(new Request('https://finance.test/api/backup'),env,owner); const backup=await response.json();
  assert.equal(backup.data.transactions.length,1); assert.equal(backup.data.transaction_events.length,2); assert.doesNotMatch(JSON.stringify(backup),/OTHER_PRIVATE/);
});
test('forecast does not extrapolate future commitments and empty months are safe',()=>{
  const data=structuredClone(EMPTY_FINANCE_DATA); data.transactions=[{...expense,id:1,date:'2026-09-30',value:300,macro:'Variável'}];
  assert.equal(getFinancialAnalytics(data,'2026-09',new Date(2026,8,1)).projectedExpenses,300);
  assert.doesNotThrow(()=>getFinancialAnalytics(data,''));
  assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"'); assert.equal(csvCell(-12),'"-12"');
});

test('stale category reads cannot orphan references or write an outdated macro',async t=>{
  const env=await fixture(t); await call(env,{...expense,installmentTotal:1});
  const category=env.db.prepare("SELECT id FROM categories WHERE name='Alimentação'").get();
  const prepare=env.DB.prepare;
  let injected=false;
  env.DB.prepare=(sql)=>{
    const statement=prepare(sql);
    if (sql.startsWith('SELECT id, name, macro FROM categories WHERE id')) {
      return {bind(...args){ const bound=statement.bind(...args); return {...bound,async first(){
        const row=await bound.first();
        if(!injected){injected=true;env.db.prepare("UPDATE categories SET name='Renomeado concorrente' WHERE id=?").run(category.id);}
        return row;
      }};}};
    }
    return statement;
  };
  assert.equal((await call(env,{action:'update_category',id:category.id,name:'Final',macro:'Fixo'})).status,200);
  assert.equal(env.db.prepare('SELECT category FROM transactions').get().category,'Final');
  assert.equal(env.db.prepare('SELECT macro FROM transactions').get().macro,'Fixo');
  assert.throws(()=>env.db.prepare("INSERT INTO transactions(owner,date,description,category,macro,type,value) VALUES (?,?,?,?,?,?,?)").run(owner,'2026-09-01','Stale','Final','Variável','saida',10),/FINANCE_REFERENCE/);
});

test('accounts, goals, subscriptions and wealth persist; referenced accounts are protected',async t=>{
  const env=await fixture(t);
  const account=await(await call(env,{action:'save_account',name:'Conta teste',type:'Conta corrente',balance:200})).json();
  const subscription=await(await call(env,{action:'save_subscription',name:'Serviço',category:'Lazer',account:'Conta teste',value:25,billingDay:31})).json();
  assert.equal((await call(env,{action:'delete_planning',entity:'account',id:account.item.id})).status,409);
  assert.equal((await call(env,{action:'save_goal',name:'Meta',target:500,current:10,deadline:'2027-01-01'})).status,201);
  const wealth=await(await call(env,{action:'save_wealth',name:'Bem',group:'Teste',kind:'Ativo',value:100})).json();
  assert.equal((await call(env,{action:'update_wealth',id:wealth.item.id,name:'Bem',group:'Teste',kind:'Ativo',value:150})).status,200);
  assert.equal((await call(env,{action:'archive_subscription',id:subscription.item.id})).status,200);
  const reloaded=await(await call(env)).json(); assert.equal(reloaded.accounts[0].balance,200); assert.equal(reloaded.goals[0].current,10); assert.equal(reloaded.wealthItems[0].value,150); assert.equal(reloaded.subscriptions[0].status,'Inativa');
});

test('maximum length installment descriptions remain editable and importable',async t=>{
  const env=await fixture(t);
  const response=await call(env,{...expense,description:'A'.repeat(180),installmentTotal:120,value:120});
  assert.equal(response.status,201);
  const {items}=await response.json();
  const item=items.at(-1);
  assert.equal(item.description.length,190);
  assert.equal((await call(env,{...item,action:'update_transaction',value:2})).status,200);
  assert.equal((await call(env,{action:'bulk_import',rows:[item]})).status,201);
});

test('settings patches preserve other preferences and return committed values',async t=>{
  const env=await fixture(t);
  await call(env,{action:'save_settings',profileName:'Nome real',exportOwner:false});
  await call(env,{action:'save_settings',theme:'dark'});
  const response=await call(env,{action:'save_settings',density:'compact'});
  const {item}=await response.json();
  assert.equal(item.profileName,'Nome real'); assert.equal(item.exportOwner,false);
  assert.equal(item.theme,'dark'); assert.equal(item.density,'compact');
  assert.equal((await call(env,{action:'save_settings',theme:'invalid'})).status,400);
  assert.equal((await(await call(env)).json()).settings.theme,'dark');
});
