import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import ExcelJS from 'exceljs';
import {loadSource,root} from './helpers.mjs';
const excel=loadSource(resolve(root,'lib/excel'));
const {EMPTY_FINANCE_DATA}=loadSource(resolve(root,'lib/finance/types'));
const {getFinancialAnalytics}=loadSource(resolve(root,'lib/finance/analytics'));

test('Excel exports contain real rows, full filter range and respect owner preference',async t=>{
  const data=structuredClone(EMPTY_FINANCE_DATA);
  data.settings={...data.settings,profileName:'PRIVATE OWNER',signature:'PRIVATE SIGNATURE',exportOwner:false};
  data.transactions=[{id:1,date:'2026-09-01',description:'=1+1',category:'Teste',macro:'Fixo',type:'saida',value:123.45}];
  const context={data,settings:data.settings,month:'2026-09',analytics:getFinancialAnalytics(data,'2026-09')};
  let blob;
  t.mock.method(URL,'createObjectURL',value=>{blob=value;return 'blob:test';});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({click(){},remove(){}}),body:{appendChild(){}}};
  t.after(()=>{ if(previous)globalThis.document=previous;else delete globalThis.document; });
  await excel.exportTransactionsWorkbook(context,data.transactions,['Setembro']);
  const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(await blob.arrayBuffer());
  const sheet=workbook.worksheets[0];
  assert.match(typeof sheet.autoFilter==='string'?sheet.autoFilter:JSON.stringify(sheet.autoFilter),/9/);
  assert.equal(sheet.getCell('B9').value,'=1+1'); // Stored as text, never formula.
  assert.doesNotMatch(JSON.stringify(workbook.model),/PRIVATE OWNER/);
  assert.match(JSON.stringify(workbook.model),/PRIVATE SIGNATURE/);
  context.settings.exportIdentity=false;
  await excel.exportFullWorkbook(context);
  const full=new ExcelJS.Workbook();await full.xlsx.load(await blob.arrayBuffer());
  assert.equal(full.worksheets.length,11);
  assert.doesNotMatch(JSON.stringify(full.model),/PRIVATE OWNER|PRIVATE SIGNATURE/);
});
