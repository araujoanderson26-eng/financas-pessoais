"use client";

import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { AppShell, type GlobalSearchItem } from "@/components/layout/AppShell";
import { CategoryDeleteDialog, FinanceModals, type FinanceModal } from "@/components/modals/FinanceModals";
import { ConfirmDialog, Skeleton, ToastViewport, type ToastItem } from "@/components/shared";
import { useFinanceData } from "@/hooks/useFinanceData";
import { getFinancialAnalytics } from "@/lib/finance/analytics";
import { currentMonthKey, localIsoDate } from "@/lib/formatters";
import type { Category, Investment, Subscription, Tab, Transaction, UserSettings, WealthItem } from "@/lib/finance/types";

const DashboardView = lazy(() => import("@/components/dashboard/DashboardView").then((module) => ({ default: module.DashboardView })));
const TransactionsView = lazy(() => import("@/components/transactions/TransactionsView").then((module) => ({ default: module.TransactionsView })));
const PlanningView = lazy(() => import("@/components/planning/PlanningView").then((module) => ({ default: module.PlanningView })));
const WealthView = lazy(() => import("@/components/wealth/WealthView").then((module) => ({ default: module.WealthView })));
const InvestmentsView = lazy(() => import("@/components/investments/InvestmentsView").then((module) => ({ default: module.InvestmentsView })));
const SubscriptionsView = lazy(() => import("@/components/subscriptions/SubscriptionsView").then((module) => ({ default: module.SubscriptionsView })));
const CategoriesView = lazy(() => import("@/components/categories/CategoriesView").then((module) => ({ default: module.CategoriesView })));
const HistoryView = lazy(() => import("@/components/history/HistoryView").then((module) => ({ default: module.HistoryView })));
const AdvisorView = lazy(() => import("@/components/advisor/AdvisorView").then((module) => ({ default: module.AdvisorView })));
const SettingsView = lazy(() => import("@/components/settings/SettingsView").then((module) => ({ default: module.SettingsView })));
const ReportView = lazy(() => import("@/components/reports/ReportView").then((module) => ({ default: module.ReportView })));

const loadExcel = () => import("@/lib/excel");

type DeleteTarget = {
  kind: "transaction" | "investment" | "subscription" | "account" | "budget" | "goal" | "wealth";
  id: number;
  label: string;
};

export default function Home() {
  const { data, setData, syncState, refresh, sendAction } = useFinanceData();
  const [active, setActive] = useState<Tab>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [modal, setModal] = useState<FinanceModal>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState("");
  const [categoryDeleteBusy, setCategoryDeleteBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const analytics = useMemo(() => getFinancialAnalytics(data, selectedMonth), [data, selectedMonth]);
  const reportNote = data.reportNotes.find((item) => item.month === selectedMonth);
  const exportContext = { data, analytics, month: selectedMonth, settings: data.settings, note: reportNote?.note || "" };
  const syncLabel = syncState === "saved" ? "Dados salvos" : syncState === "saving" ? "Salvando" : syncState === "loading" ? "Conectando" : syncState === "local" ? "Modo local" : "Erro de sincronização";
  const searchItems = useMemo<GlobalSearchItem[]>(() => [
    ...data.transactions.map((item) => ({ id: `transaction-${item.id}`, label: item.description, meta: `Movimentação · ${item.category}`, tab: "movimentos" as Tab })),
    ...data.accounts.map((item) => ({ id: `account-${item.id}`, label: item.name, meta: `Conta · ${item.type}`, tab: "planejamento" as Tab })),
    ...data.investments.map((item) => ({ id: `investment-${item.id}`, label: item.name, meta: `Investimento · ${item.type}`, tab: "investimentos" as Tab })),
    ...data.goals.map((item) => ({ id: `goal-${item.id}`, label: item.name, meta: "Meta financeira", tab: "planejamento" as Tab })),
    ...data.subscriptions.map((item) => ({ id: `subscription-${item.id}`, label: item.name, meta: `Assinatura · ${item.category}`, tab: "assinaturas" as Tab })),
  ], [data]);

  function toast(tone: ToastItem["tone"], title: string, description?: string) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, title, description }].slice(-4));
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }

  function closeModal() {
    setModal(null);
    setEditingTransaction(null);
    setEditingCategory(null);
    setEditingInvestment(null);
  }

  function openTransaction(item?: Transaction) {
    setEditingTransaction(item || null);
    setModal("transaction");
  }

  function openInvestment(item?: Investment) {
    setEditingInvestment(item || null);
    setModal("investment");
  }

  function openCategory(item?: Category) {
    setEditingCategory(item || null);
    setModal("category");
  }

  function openCategoryDelete(item: Category) {
    setDeletingCategory(item);
    setReplacementCategoryId("");
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      await sendAction({ action: editingTransaction ? "update_transaction" : "transaction", id: editingTransaction?.id, ...values, value: Number(values.value), installmentTotal: Number(values.installmentTotal || editingTransaction?.installmentTotal || 1) });
      const wasEditing = Boolean(editingTransaction);
      closeModal();
      toast("success", wasEditing ? "Alterações salvas" : "Lançamento registrado", wasEditing ? "Os totais foram recalculados." : Number(values.installmentTotal || 1) > 1 ? "As parcelas futuras foram criadas sem duplicar o valor total." : "A movimentação já está nos indicadores.");
    } catch (error) { toast("error", "Não foi possível salvar", error instanceof Error ? error.message : undefined); }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const wasEditing = Boolean(editingCategory);
      await sendAction({ action: wasEditing ? "update_category" : "category", id: editingCategory?.id, ...values });
      closeModal();
      toast("success", wasEditing ? "Categoria atualizada" : "Categoria criada", wasEditing ? "Lançamentos e outras referências foram mantidos consistentes." : undefined);
    } catch (error) { toast("error", "Não foi possível salvar a categoria", error instanceof Error ? error.message : undefined); }
  }

  async function confirmCategoryDelete() {
    if (!deletingCategory) return;
    const hasReferences = Number(deletingCategory.referenceCount ?? deletingCategory.transactionCount ?? 0) > 0;
    setCategoryDeleteBusy(true);
    try {
      if (hasReferences) {
        await sendAction({ action: "replace_and_delete_category", id: deletingCategory.id, replacementId: Number(replacementCategoryId) });
        toast("success", "Categoria excluída", "Todos os lançamentos e referências foram transferidos.");
      } else {
        await sendAction({ action: "delete_category", id: deletingCategory.id });
        toast("success", "Categoria excluída");
      }
      setDeletingCategory(null);
      setReplacementCategoryId("");
    } catch (error) {
      toast("error", "Não foi possível excluir a categoria", error instanceof Error ? error.message : undefined);
      void refresh(true);
    } finally {
      setCategoryDeleteBusy(false);
    }
  }

  async function submitInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const wasEditing = Boolean(editingInvestment);
      await sendAction({ action: wasEditing ? "update_investment" : "investment", id: editingInvestment?.id, ...values, value: Number(values.value), returnPct: Number(values.returnPct || 0) });
      closeModal(); toast("success", wasEditing ? "Investimento atualizado" : "Investimento cadastrado");
    } catch (error) { toast("error", "Não foi possível salvar o investimento", error instanceof Error ? error.message : undefined); }
  }

  async function savePlanning(event: FormEvent<HTMLFormElement>, kind: "account" | "budget" | "goal") {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try { await sendAction({ action: `save_${kind}`, ...values }); form.reset(); toast("success", kind === "account" ? "Conta adicionada" : kind === "budget" ? "Orçamento salvo" : "Meta criada"); }
    catch (error) { toast("error", "Não foi possível salvar", error instanceof Error ? error.message : undefined); }
  }

  async function saveWealth(values: Record<string, unknown>, editingId?: number) {
    try { await sendAction({ action: editingId ? "update_wealth" : "save_wealth", id: editingId, ...values }); toast("success", editingId ? "Item patrimonial atualizado" : "Item patrimonial adicionado"); }
    catch (error) { toast("error", "Não foi possível salvar o patrimônio", error instanceof Error ? error.message : undefined); throw error; }
  }

  async function saveSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try { await sendAction({ action: "save_subscription", ...values }); form.reset(); toast("success", "Assinatura adicionada", "O impacto mensal e anual foi atualizado."); }
    catch (error) { toast("error", "Não foi possível salvar a assinatura", error instanceof Error ? error.message : undefined); }
  }

  async function saveReportNote(note: string) {
    try { await sendAction({ action: "save_report_note", month: selectedMonth, note }); toast("success", "Observações salvas"); }
    catch (error) { toast("error", "Não foi possível salvar as observações", error instanceof Error ? error.message : undefined); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "transaction") await sendAction({ action: "delete_transaction", id: deleteTarget.id });
      else if (deleteTarget.kind === "investment") await sendAction({ action: "delete_investment", id: deleteTarget.id });
      else if (deleteTarget.kind === "subscription") await sendAction({ action: "archive_subscription", id: deleteTarget.id });
      else await sendAction({ action: "delete_planning", entity: deleteTarget.kind, id: deleteTarget.id });
      toast("success", deleteTarget.kind === "transaction" || deleteTarget.kind === "subscription" ? "Item arquivado" : "Item removido", deleteTarget.kind === "transaction" ? "A trilha de auditoria foi preservada." : undefined);
      setDeleteTarget(null);
    } catch (error) { toast("error", "A ação não foi concluída", error instanceof Error ? error.message : undefined); }
  }

  async function saveSettings(next: UserSettings) {
    setData((current) => ({ ...current, settings: next }));
    try { await sendAction({ action: "save_settings", ...next }, { refresh: false }); toast("success", "Configuração salva"); }
    catch (error) { toast("error", "Não foi possível salvar a configuração", error instanceof Error ? error.message : undefined); void refresh(true); }
  }

  function patchSettings(patch: Partial<UserSettings>) { void saveSettings({ ...data.settings, ...patch }); }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    void saveSettings({ ...data.settings, profileName: String(values.profileName), productName: String(values.productName), signature: String(values.signature) });
  }

  function downloadBackup() {
    const link = document.createElement("a");
    link.href = "/api/backup";
    link.download = `Nexo_Backup_Completo_${localIsoDate()}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    toast("info", "Backup iniciado", "O arquivo JSON inclui dados, configurações e histórico.");
    window.setTimeout(() => void refresh(true), 1500);
  }

  function exportCsv(rows: Transaction[]) {
    const header = "data,descricao,categoria,natureza,tipo,valor,conta,recorrencia,parcela,total_parcelas";
    const lines = rows.map((item) => [item.date,item.description,item.category,item.macro,item.type,item.value,item.account||"",item.recurrence||"Não",item.installmentCurrent||1,item.installmentTotal||1].map((value) => `"${String(value).replaceAll('"','""')}"`).join(","));
    const blob = new Blob(["\ufeff" + [header,...lines].join("\n")],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download=`Nexo_Movimentacoes_${selectedMonth}.csv`; link.click(); URL.revokeObjectURL(url);
    toast("info", "Exportação CSV iniciada");
  }

  async function runExcel(label: string, task: () => Promise<void>, record = true) {
    toast("info", "Preparando Excel", `${label} será formatado com a identidade Nexo.`);
    try {
      await task();
      if (record) await sendAction({ action: "record_backup", kind: label }, { refresh: true });
      toast("success", "Excel gerado", `${label} está pronto para abrir no Excel ou LibreOffice.`);
    } catch (error) { toast("error", "Falha ao gerar Excel", error instanceof Error ? error.message : undefined); }
  }

  async function askAdvisor(question: string) {
    const response = await fetch("/api/advisor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, summary: { ...analytics.totals, portfolioTotal: analytics.portfolioTotal, reserve: analytics.emergencyReserve, budgetTotal: analytics.budgetTotal, projectedExpenses: analytics.projectedExpenses, netWorth: analytics.netWorth, recurringCommitment: analytics.recurringCommitment, alerts: analytics.alerts.map((item) => item.text) } }) });
    const result = await response.json() as { answer?: string; error?: string };
    if (!response.ok || !result.answer) throw new Error(result.error || "Não foi possível concluir a análise.");
    return result.answer;
  }

  const currentContent = syncState === "loading" && data.categories.length === 0 ? <section className="loading-page"><div className="skeleton-title"><Skeleton rows={2}/></div><div className="skeleton-grid">{Array.from({length:8},(_,index)=><article key={index}><Skeleton rows={3}/></article>)}</div></section> : <>
    {active === "dashboard" && <DashboardView data={data} analytics={analytics} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} hidden={data.settings.hideValues} onNavigate={setActive} onNewTransaction={() => openTransaction()}/>}
    {active === "movimentos" && <TransactionsView transactions={data.transactions} categories={data.categories} accounts={data.accounts} selectedMonth={selectedMonth} hidden={data.settings.hideValues} onNew={() => openTransaction()} onEdit={openTransaction} onArchive={(item) => setDeleteTarget({kind:"transaction",id:item.id,label:item.description})} onExportXlsx={(rows,filters) => void runExcel("Excel de movimentações",async()=>{const excel=await loadExcel(); await excel.exportTransactionsWorkbook(exportContext,rows,filters);},false)} onExportCsv={exportCsv}/>}
    {active === "planejamento" && <PlanningView data={data} analytics={analytics} selectedMonth={selectedMonth} hidden={data.settings.hideValues} onSave={savePlanning} onDelete={(kind,id,label)=>setDeleteTarget({kind,id,label})} onExport={() => void runExcel("Excel de planejamento",async()=>{const excel=await loadExcel(); await excel.exportPlanningWorkbook(exportContext);},false)}/>}
    {active === "patrimonio" && <WealthView items={data.wealthItems} analytics={analytics} hidden={data.settings.hideValues} onSave={saveWealth} onDelete={(item:WealthItem)=>setDeleteTarget({kind:"wealth",id:item.id,label:item.name})} onExport={() => void runExcel("Excel patrimonial",async()=>{const excel=await loadExcel(); await excel.exportWealthWorkbook(exportContext);},false)}/>}
    {active === "categorias" && <CategoriesView categories={data.categories} transactions={data.transactions} onNew={()=>openCategory()} onEdit={openCategory} onDelete={openCategoryDelete}/>}
    {active === "investimentos" && <InvestmentsView investments={data.investments} goals={data.goals} analytics={analytics} hidden={data.settings.hideValues} onNew={()=>openInvestment()} onEdit={openInvestment} onDelete={(item)=>item.id&&setDeleteTarget({kind:"investment",id:item.id,label:item.name})} onExport={() => void runExcel("Excel de investimentos",async()=>{const excel=await loadExcel(); await excel.exportInvestmentsWorkbook(exportContext);},false)}/>}
    {active === "assinaturas" && <SubscriptionsView subscriptions={data.subscriptions} transactions={data.transactions} categories={data.categories} accounts={data.accounts} hidden={data.settings.hideValues} onSave={saveSubscription} onArchive={(item:Subscription)=>setDeleteTarget({kind:"subscription",id:item.id,label:item.name})} onExport={() => void runExcel("Excel de assinaturas",async()=>{const excel=await loadExcel(); await excel.exportSubscriptionsWorkbook(exportContext);},false)}/>}
    {active === "historico" && <HistoryView events={data.auditEvents} backups={data.backupEvents} hidden={data.settings.hideValues} syncLabel={syncLabel} onBackupJson={downloadBackup} onFullExcel={() => void runExcel("Excel completo",async()=>{const excel=await loadExcel(); await excel.exportFullWorkbook(exportContext);})}/>}
    {active === "relatorio" && <ReportView key={`${selectedMonth}-${reportNote?.updatedAt||"new"}`} data={data} analytics={analytics} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} hidden={data.settings.hideValues} initialNote={reportNote?.note||""} onSaveNote={saveReportNote} onPrint={()=>window.print()} onExcel={() => void runExcel("Relatório mensal em Excel",async()=>{const excel=await loadExcel(); await excel.exportMonthlyWorkbook(exportContext);},false)}/>}
    {active === "consultor" && <AdvisorView analytics={analytics} onAsk={askAdvisor}/>}
    {active === "configuracoes" && <SettingsView settings={data.settings} lastBackup={data.backupEvents[0]} syncState={syncLabel} onPatch={patchSettings} onSaveProfile={saveProfile} onBackupJson={downloadBackup} onFullExcel={() => void runExcel("Excel completo",async()=>{const excel=await loadExcel(); await excel.exportFullWorkbook(exportContext);})}/>}
  </>;

  return <>
    <AppShell active={active} onNavigate={setActive} selectedMonth={selectedMonth} syncState={syncState} settings={data.settings} alertCount={analytics.alerts.length} searchItems={searchItems} onNewTransaction={() => openTransaction()} onTogglePrivacy={() => patchSettings({hideValues:!data.settings.hideValues})}><Suspense fallback={<section className="loading-page"><Skeleton rows={5}/></section>}>{currentContent}</Suspense></AppShell>
    <FinanceModals modal={modal} categories={data.categories} accounts={data.accounts} editingTransaction={editingTransaction} editingCategory={editingCategory} editingInvestment={editingInvestment} onClose={closeModal} onTransaction={submitTransaction} onCategory={submitCategory} onInvestment={submitInvestment}/>
    <CategoryDeleteDialog category={deletingCategory} categories={data.categories} replacementId={replacementCategoryId} busy={categoryDeleteBusy} onReplacementChange={setReplacementCategoryId} onCancel={()=>{setDeletingCategory(null);setReplacementCategoryId("");}} onConfirm={()=>void confirmCategoryDelete()}/>
    <ConfirmDialog open={Boolean(deleteTarget)} title={deleteTarget?.kind === "transaction" ? "Arquivar lançamento?" : deleteTarget?.kind === "subscription" ? "Arquivar assinatura?" : "Remover item?"} description={deleteTarget ? deleteTarget.kind === "transaction" ? `“${deleteTarget.label}” deixará de afetar os totais, mas continuará no histórico de auditoria.` : deleteTarget.kind === "subscription" ? `“${deleteTarget.label}” ficará inativa e deixará de compor o custo mensal.` : `“${deleteTarget.label}” será removido e os indicadores relacionados serão recalculados.` : ""} confirmLabel={deleteTarget?.kind === "transaction" || deleteTarget?.kind === "subscription" ? "Arquivar" : "Remover"} onCancel={()=>setDeleteTarget(null)} onConfirm={()=>void confirmDelete()}/>
    <ToastViewport items={toasts} dismiss={(id)=>setToasts((current)=>current.filter((item)=>item.id!==id))}/>
  </>;
}
