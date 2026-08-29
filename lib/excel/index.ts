import type { Workbook, Worksheet } from "exceljs";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import type { FinanceData, Transaction, UserSettings } from "@/lib/finance/types";
import { fileTimestamp, formatDate, formatDateTime, formatMonth, formatPercent } from "@/lib/formatters";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
type ColumnSpec = { header: string; key: string; width?: number; format?: "currency" | "percent" | "date" | "number" };
type Row = Record<string, string | number | boolean | null | undefined>;
type ExportContext = { data: FinanceData; analytics: Analytics; month: string; settings: UserSettings; note?: string };

const palette = { green: "FF1F6B52", deep: "FF164A3B", soft: "FFDCEBE4", gold: "FFD9A441", goldSoft: "FFF5ECD5", red: "FFB75F51", blue: "FF426C8F", ink: "FF18201D", muted: "FF66716C", line: "FFE3E7E4", white: "FFFFFFFF", alternate: "FFF6F7F4" };

function safeSheetName(value: string) { return value.replace(/[\\/*?:[\]]/g, " ").slice(0, 31); }

function addMetadata(sheet: Worksheet, reportName: string, period: string, settings: UserSettings, lastColumn: number, filters: string[] = []) {
  const owner = settings.exportOwner ? settings.profileName : "";
  const values = [
    settings.exportIdentity ? "NEXO FINANÇAS PESSOAIS" : settings.productName,
    settings.exportIdentity ? settings.signature : owner,
    reportName,
    period,
    settings.exportGeneratedAt ? `Gerado em ${fileTimestamp()}` : "",
  ];
  values.forEach((value, index) => {
    const rowNumber = index + 1;
    sheet.mergeCells(rowNumber, 1, rowNumber, Math.max(1, lastColumn));
    const cell = sheet.getCell(rowNumber, 1);
    cell.value = value;
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.font = { name: "Aptos", bold: index !== 4, size: index === 0 ? 18 : index === 2 ? 14 : 10, color: { argb: index < 2 ? palette.white : palette.ink } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index === 0 ? palette.deep : index === 1 ? palette.green : index === 2 ? palette.goldSoft : palette.white } };
    sheet.getRow(rowNumber).height = index === 0 ? 28 : index === 2 ? 23 : 19;
  });
  sheet.mergeCells(6, 1, 6, Math.max(1, lastColumn));
  const filterCell = sheet.getCell(6, 1);
  filterCell.value = settings.exportFilters ? (filters.length ? `Filtros: ${filters.join(" · ")}` : "Filtros: visão completa") : "";
  filterCell.font = { name: "Aptos", italic: true, size: 9, color: { argb: palette.muted } };
  filterCell.alignment = { vertical: "middle" };
  sheet.getRow(7).height = 8;
}

function addDataSheet(workbook: Workbook, name: string, reportName: string, period: string, columns: ColumnSpec[], rows: Row[], settings: UserSettings, options: { filters?: string[]; totals?: Row; emptyMessage?: string } = {}) {
  const sheet = workbook.addWorksheet(safeSheetName(name), { properties: { defaultRowHeight: 18 }, views: settings.exportFreezeHeader ? [{ state: "frozen", ySplit: 8, activeCell: "A9" }] : [] });
  addMetadata(sheet, reportName, period, settings, columns.length, options.filters);
  const headerRow = sheet.getRow(8);
  headerRow.values = columns.map((column) => column.header);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Aptos", bold: true, size: 10, color: { argb: palette.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.green } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "medium", color: { argb: palette.gold } } };
  });
  columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width || 18; });
  if (rows.length) {
    rows.forEach((item, rowIndex) => {
      const row = sheet.getRow(9 + rowIndex);
      row.values = columns.map((column) => item[column.key] ?? "");
      row.height = 20;
      row.eachCell((cell, columnIndex) => {
        const spec = columns[columnIndex - 1];
        cell.font = { name: "Aptos", size: 10, color: { argb: palette.ink } };
        cell.alignment = { vertical: "middle", horizontal: spec?.format === "currency" || spec?.format === "percent" || spec?.format === "number" ? "right" : "left" };
        if (rowIndex % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.alternate } };
        cell.border = { bottom: { style: "hair", color: { argb: palette.line } } };
        if (spec?.format === "currency") cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
        if (spec?.format === "percent") cell.numFmt = '0.0%';
        if (spec?.format === "number") cell.numFmt = '#,##0.00';
      });
    });
  } else {
    const row = sheet.getRow(9);
    sheet.mergeCells(9, 1, 9, columns.length);
    row.getCell(1).value = options.emptyMessage || "Nenhum registro para os filtros selecionados.";
    row.getCell(1).font = { name: "Aptos", italic: true, color: { argb: palette.muted } };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    row.height = 24;
  }
  sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: columns.length } };
  if (settings.exportTotals && options.totals) {
    const totalRowNumber = 10 + Math.max(1, rows.length);
    const totalRow = sheet.getRow(totalRowNumber);
    totalRow.values = columns.map((column) => options.totals?.[column.key] ?? "");
    totalRow.height = 23;
    totalRow.eachCell((cell, columnIndex) => {
      const spec = columns[columnIndex - 1];
      cell.font = { name: "Aptos", bold: true, color: { argb: palette.deep } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: palette.soft } };
      if (spec?.format === "currency") cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
      if (spec?.format === "percent") cell.numFmt = '0.0%';
    });
  }
  sheet.pageSetup = { paperSize: 9, orientation: columns.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  sheet.headerFooter = { oddFooter: `Nexo Finanças Pessoais — ${settings.signature} &R Página &P de &N` };
  return sheet;
}

async function createWorkbook() {
  const excelModule = await import("exceljs") as typeof import("exceljs") & { default?: typeof import("exceljs") };
  const Excel = excelModule.default ?? excelModule;
  const workbook = new Excel.Workbook();
  workbook.creator = "Nexo Finanças Pessoais";
  workbook.company = "Anderson de Araujo";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

async function download(workbook: Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const transactionColumns: ColumnSpec[] = [
  { header: "Data", key: "date", width: 14 }, { header: "Descrição", key: "description", width: 34 }, { header: "Categoria", key: "category", width: 20 }, { header: "Natureza", key: "macro", width: 15 }, { header: "Tipo", key: "type", width: 12 }, { header: "Valor", key: "value", width: 17, format: "currency" }, { header: "Conta", key: "account", width: 22 }, { header: "Recorrência", key: "recurrence", width: 15 }, { header: "Parcela", key: "installmentCurrent", width: 11, format: "number" }, { header: "Total parcelas", key: "installmentTotal", width: 14, format: "number" },
];
const transactionRows = (rows: Transaction[]): Row[] => rows.map((item) => ({ ...item, date: formatDate(item.date), type: item.type === "entrada" ? "Entrada" : "Saída", account: item.account || "Não informado", recurrence: item.recurrence || "Não", installmentCurrent: item.installmentCurrent || 1, installmentTotal: item.installmentTotal || 1 }));

export async function exportTransactionsWorkbook(context: ExportContext, rows: Transaction[], filters: string[] = []) {
  const workbook = await createWorkbook();
  const income = rows.filter((item) => item.type === "entrada").reduce((sum,item)=>sum+item.value,0);
  const expenses = rows.filter((item) => item.type === "saida").reduce((sum,item)=>sum+item.value,0);
  addDataSheet(workbook,"Movimentações","Relatório de movimentações",formatMonth(context.month),transactionColumns,transactionRows(rows),context.settings,{filters,totals:{description:"TOTAIS",value:income-expenses,account:`Entradas ${formatCurrencyText(income)} · Saídas ${formatCurrencyText(expenses)}`}});
  await download(workbook,`Nexo_Movimentacoes_${context.month}.xlsx`);
}

function formatCurrencyText(value:number){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);}
const budgetColumns: ColumnSpec[]=[{header:"Mês",key:"month",width:13},{header:"Categoria",key:"category",width:25},{header:"Orçado",key:"amount",width:17,format:"currency"},{header:"Realizado",key:"actual",width:17,format:"currency"},{header:"Diferença",key:"difference",width:17,format:"currency"},{header:"% utilizado",key:"used",width:14,format:"percent"}];

function addPlanningSheets(workbook:Workbook,context:ExportContext,includeCommitments=true){
  const {data,analytics,settings,month}=context; const period=formatMonth(month);
  addDataSheet(workbook,"Orçamento","Planejamento — Orçamento",period,budgetColumns,analytics.budgetByCategory.map((item)=>({month:item.month,category:item.category,amount:item.amount,actual:item.actual,difference:item.difference,used:item.usedPct/100})),settings,{totals:{category:"TOTAIS",amount:analytics.budgetTotal,actual:analytics.totals.expenses,difference:analytics.budgetTotal-analytics.totals.expenses}});
  addDataSheet(workbook,"Contas","Planejamento — Contas",period,[{header:"Conta",key:"name",width:28},{header:"Tipo",key:"type",width:20},{header:"Escopo",key:"scope",width:10},{header:"Instituição",key:"institution",width:24},{header:"Saldo",key:"balance",width:18,format:"currency"}],data.accounts.filter((item)=>item.type!=="Cartão de crédito"),settings,{totals:{institution:"TOTAL",balance:analytics.accountBalance}});
  addDataSheet(workbook,"Cartões","Planejamento — Cartões",period,[{header:"Cartão",key:"name",width:28},{header:"Instituição",key:"institution",width:24},{header:"Escopo",key:"scope",width:10},{header:"Limite",key:"creditLimit",width:18,format:"currency"},{header:"Fechamento",key:"closingDay",width:13,format:"number"},{header:"Vencimento",key:"dueDay",width:13,format:"number"}],data.accounts.filter((item)=>item.type==="Cartão de crédito"),settings);
  addDataSheet(workbook,"Metas","Planejamento — Metas",period,[{header:"Meta",key:"name",width:30},{header:"Valor alvo",key:"target",width:18,format:"currency"},{header:"Acumulado",key:"current",width:18,format:"currency"},{header:"Faltante",key:"missing",width:18,format:"currency"},{header:"Prazo",key:"deadline",width:15}],data.goals.map((item)=>({...item,missing:Math.max(0,item.target-item.current),deadline:formatDate(item.deadline)})),settings);
  if(includeCommitments){const recurring=[...data.transactions.filter((item)=>item.recurrence&&item.recurrence!=="Não").map((item)=>({name:item.description,category:item.category,account:item.account,value:item.value,frequency:item.recurrence,source:"Movimentação"})),...data.subscriptions.filter((item)=>item.status==="Ativa").map((item)=>({name:item.name,category:item.category,account:item.account,value:item.value,frequency:"Mensal",source:"Assinatura"}))];
  addDataSheet(workbook,"Recorrências","Planejamento — Recorrências",period,[{header:"Descrição",key:"name",width:32},{header:"Categoria",key:"category",width:20},{header:"Conta",key:"account",width:22},{header:"Valor",key:"value",width:18,format:"currency"},{header:"Frequência",key:"frequency",width:15},{header:"Origem",key:"source",width:16}],recurring,settings,{totals:{account:"TOTAL MENSAL",value:analytics.recurringCommitment}});
  addDataSheet(workbook,"Parcelamentos","Planejamento — Parcelamentos",period,[{header:"Data",key:"date",width:14},{header:"Descrição",key:"description",width:34},{header:"Conta",key:"account",width:22},{header:"Parcela",key:"installmentCurrent",width:11,format:"number"},{header:"Total",key:"installmentTotal",width:11,format:"number"},{header:"Valor",key:"value",width:18,format:"currency"}],analytics.futureInstallments.map((item)=>({...item,date:formatDate(item.date)})),settings,{totals:{account:"TOTAL FUTURO",value:analytics.futureInstallmentTotal}});}
}

export async function exportPlanningWorkbook(context:ExportContext){const workbook=await createWorkbook();addPlanningSheets(workbook,context);await download(workbook,`Nexo_Planejamento_${context.month}.xlsx`);}

function addWealthSheet(workbook:Workbook,context:ExportContext){const rows=context.data.wealthItems.map((item)=>({name:item.name,kind:item.kind,group:item.group,value:item.value,debt:item.kind==="Ativo"?Number(item.remainingDebt||0):item.value,net:item.kind==="Ativo"?item.value-Number(item.remainingDebt||0):-item.value}));addDataSheet(workbook,"Patrimônio","Relatório patrimonial","Posição atual",[{header:"Item",key:"name",width:32},{header:"Tipo",key:"kind",width:13},{header:"Grupo",key:"group",width:20},{header:"Valor",key:"value",width:18,format:"currency"},{header:"Dívida",key:"debt",width:18,format:"currency"},{header:"Valor líquido",key:"net",width:18,format:"currency"}],rows,context.settings,{totals:{group:"ATIVOS / PASSIVOS / LÍQUIDO",value:context.analytics.grossAssets,debt:context.analytics.liabilities,net:context.analytics.netWorth}});}
export async function exportWealthWorkbook(context:ExportContext){const workbook=await createWorkbook();addWealthSheet(workbook,context);await download(workbook,`Nexo_Patrimonio_${new Date().toISOString().slice(0,10)}.xlsx`);}

function addInvestmentsSheet(workbook:Workbook,context:ExportContext){addDataSheet(workbook,"Investimentos","Relatório de investimentos","Posição atual",[{header:"Investimento",key:"name",width:32},{header:"Classe",key:"type",width:20},{header:"Valor",key:"value",width:18,format:"currency"},{header:"Rentabilidade",key:"return",width:17,format:"percent"},{header:"Participação",key:"share",width:17,format:"percent"}],context.data.investments.map((item)=>({name:item.name,type:item.type,value:item.value,return:item.returnPct/100,share:context.analytics.portfolioTotal?item.value/context.analytics.portfolioTotal:0})),context.settings,{totals:{type:"TOTAL / MÉDIA",value:context.analytics.portfolioTotal,return:context.analytics.averageReturn/100,share:context.analytics.portfolioTotal?1:0}});}
export async function exportInvestmentsWorkbook(context:ExportContext){const workbook=await createWorkbook();addInvestmentsSheet(workbook,context);await download(workbook,`Nexo_Investimentos_${new Date().toISOString().slice(0,10)}.xlsx`);}

function addSubscriptionsSheet(workbook:Workbook,context:ExportContext){addDataSheet(workbook,"Assinaturas","Relatório de assinaturas","Posição atual",[{header:"Assinatura",key:"name",width:30},{header:"Categoria",key:"category",width:20},{header:"Conta",key:"account",width:22},{header:"Custo mensal",key:"value",width:18,format:"currency"},{header:"Custo anual",key:"annual",width:18,format:"currency"},{header:"Vencimento",key:"billingDay",width:13,format:"number"},{header:"Status",key:"status",width:13}],context.data.subscriptions.map((item)=>({...item,annual:item.value*12})),context.settings,{totals:{account:"TOTAL ATIVO",value:context.analytics.subscriptionMonthly,annual:context.analytics.subscriptionMonthly*12}});}
export async function exportSubscriptionsWorkbook(context:ExportContext){const workbook=await createWorkbook();addSubscriptionsSheet(workbook,context);await download(workbook,`Nexo_Assinaturas_${new Date().toISOString().slice(0,10)}.xlsx`);}

function addSummarySheet(workbook:Workbook,context:ExportContext,title="Resumo executivo"){const a=context.analytics;const rows=[{indicator:"Patrimônio líquido",value:a.netWorth,detail:"Ativos menos passivos"},{indicator:"Saldo disponível",value:a.accountBalance,detail:"Contas sem cartões"},{indicator:"Investimentos",value:a.portfolioTotal,detail:`Rentabilidade média ${formatPercent(a.averageReturn)}`},{indicator:"Reserva",value:a.emergencyReserve,detail:`${a.reserveMonths.toFixed(1)} meses de cobertura`},{indicator:"Dívidas",value:a.liabilities,detail:"Obrigações registradas"},{indicator:"Receita mensal",value:a.totals.income,detail:formatMonth(context.month)},{indicator:"Despesa mensal",value:a.totals.expenses,detail:formatMonth(context.month)},{indicator:"Saldo mensal",value:a.totals.balance,detail:`Poupança ${formatPercent(a.totals.savingsRate)}`},{indicator:"Orçamento",value:a.budgetTotal,detail:`Realizado ${formatCurrencyText(a.totals.expenses)}`},{indicator:"Compromissos recorrentes",value:a.recurringCommitment,detail:"Mensal"},{indicator:"Parcelas futuras",value:a.futureInstallmentTotal,detail:`${a.futureInstallments.length} parcelas`}];addDataSheet(workbook,"Resumo",title,formatMonth(context.month),[{header:"Indicador",key:"indicator",width:32},{header:"Valor",key:"value",width:20,format:"currency"},{header:"Detalhe",key:"detail",width:40}],rows,context.settings);}

export async function exportFullWorkbook(context:ExportContext){const workbook=await createWorkbook();addSummarySheet(workbook,context,"Nexo Finanças Pessoais — Resumo completo");addDataSheet(workbook,"Movimentações","Movimentações completas","Todos os períodos",transactionColumns,transactionRows(context.data.transactions),context.settings);addPlanningSheets(workbook,context,false);addWealthSheet(workbook,context);addInvestmentsSheet(workbook,context);addSubscriptionsSheet(workbook,context);addDataSheet(workbook,"Categorias","Categorias","Estrutura atual",[{header:"Categoria",key:"name",width:28},{header:"Macrocategoria",key:"macro",width:20}],context.data.categories,context.settings);addDataSheet(workbook,"Histórico","Histórico de movimentações","Últimos eventos",[{header:"Data e hora",key:"createdAt",width:22},{header:"Ação",key:"action",width:15},{header:"Lançamento",key:"transactionId",width:14,format:"number"},{header:"Snapshot",key:"snapshot",width:70}],context.data.auditEvents.map((item)=>({...item,createdAt:formatDateTime(item.createdAt)})),context.settings);await download(workbook,`Nexo_Financas_Pessoais_Completo_${new Date().toISOString().slice(0,10)}.xlsx`);}

export async function exportMonthlyWorkbook(context:ExportContext){const workbook=await createWorkbook();addSummarySheet(workbook,context,"Relatório mensal — Resumo");addDataSheet(workbook,"Movimentações","Relatório mensal — Movimentações",formatMonth(context.month),transactionColumns,transactionRows(context.analytics.rows),context.settings);addDataSheet(workbook,"Despesas por categoria","Relatório mensal — Despesas por categoria",formatMonth(context.month),[{header:"Categoria",key:"name",width:30},{header:"Valor",key:"value",width:18,format:"currency"},{header:"Participação",key:"percent",width:17,format:"percent"},{header:"Variação mensal",key:"change",width:18,format:"percent"}],context.analytics.categories.map((item)=>({...item,percent:item.percent/100,change:item.change===null?null:item.change/100})),context.settings);addDataSheet(workbook,"Evolução","Relatório mensal — Evolução","Últimos 12 meses",[{header:"Mês",key:"month",width:15},{header:"Receitas",key:"entradas",width:18,format:"currency"},{header:"Despesas",key:"saidas",width:18,format:"currency"},{header:"Saldo",key:"saldo",width:18,format:"currency"}],context.analytics.monthlyTrend,context.settings);addPlanningSheetsMonthly(workbook,context);addInvestmentsSheet(workbook,context);addDataSheet(workbook,"Observações","Relatório mensal — Observações",formatMonth(context.month),[{header:"Tipo",key:"type",width:22},{header:"Conteúdo",key:"content",width:90}],[{type:"Observações do mês",content:context.note||"Nenhuma observação registrada."},...context.analytics.insights.map((content)=>({type:"Insight do Nexo",content})),...context.analytics.alerts.map((item)=>({type:`Alerta — ${item.title}`,content:item.text}))],context.settings);await download(workbook,`Nexo_Relatorio_Mensal_${context.month}.xlsx`);}

function addPlanningSheetsMonthly(workbook:Workbook,context:ExportContext){addDataSheet(workbook,"Planejamento","Relatório mensal — Planejamento",formatMonth(context.month),budgetColumns,context.analytics.budgetByCategory.map((item)=>({month:item.month,category:item.category,amount:item.amount,actual:item.actual,difference:item.difference,used:item.usedPct/100})),context.settings,{totals:{category:"TOTAIS",amount:context.analytics.budgetTotal,actual:context.analytics.totals.expenses,difference:context.analytics.budgetTotal-context.analytics.totals.expenses}});}
