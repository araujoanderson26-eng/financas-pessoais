"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownRight, ArrowUpRight, Filter, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Account, Category, Transaction } from "@/lib/finance/types";
import { formatDate } from "@/lib/formatters";
import { CurrencyValue, EmptyState, ExportButton, SectionHeader, StatusBadge } from "@/components/shared";

type SortKey = "date" | "description" | "value" | "category";

export function TransactionsView({
  transactions,
  categories,
  accounts,
  selectedMonth,
  hidden,
  onNew,
  onEdit,
  onArchive,
  onExportXlsx,
  onExportCsv,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  selectedMonth: string;
  hidden: boolean;
  onNew: () => void;
  onEdit: (item: Transaction) => void;
  onArchive: (item: Transaction) => void;
  onExportXlsx: (rows: Transaction[], filters: string[]) => void;
  onExportCsv: (rows: Transaction[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(`${selectedMonth}-01`);
  const [dateTo, setDateTo] = useState(`${selectedMonth}-${new Date(Number(selectedMonth.slice(0,4)), Number(selectedMonth.slice(5,7)), 0).getDate()}`);
  const [category, setCategory] = useState("all");
  const [account, setAccount] = useState("all");
  const [macro, setMacro] = useState("all");
  const [type, setType] = useState("all");
  const [recurrence, setRecurrence] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filtered = useMemo(() => transactions.filter((item) => {
    if (query && !item.description.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) return false;
    if (dateFrom && item.date < dateFrom) return false;
    if (dateTo && item.date > dateTo) return false;
    if (category !== "all" && item.category !== category) return false;
    if (account !== "all" && item.account !== account) return false;
    if (macro !== "all" && item.macro !== macro) return false;
    if (type !== "all" && item.type !== type) return false;
    if (recurrence !== "all" && (item.recurrence || "Não") !== recurrence) return false;
    return true;
  }).sort((a, b) => {
    const aValue = sortKey === "value" ? a.value : String(a[sortKey]).toLocaleLowerCase("pt-BR");
    const bValue = sortKey === "value" ? b.value : String(b[sortKey]).toLocaleLowerCase("pt-BR");
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === "asc" ? comparison : -comparison;
  }), [transactions, query, dateFrom, dateTo, category, account, macro, type, recurrence, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const income = filtered.filter((item) => item.type === "entrada").reduce((sum, item) => sum + item.value, 0);
  const expenses = filtered.filter((item) => item.type === "saida").reduce((sum, item) => sum + item.value, 0);

  function clearFilters() {
    setQuery(""); setDateFrom(""); setDateTo(""); setCategory("all"); setAccount("all"); setMacro("all"); setType("all"); setRecurrence("all"); setPage(1);
  }

  const filters = [dateFrom && `De ${formatDate(dateFrom)}`, dateTo && `Até ${formatDate(dateTo)}`, category !== "all" && `Categoria: ${category}`, account !== "all" && `Conta: ${account}`, macro !== "all" && `Natureza: ${macro}`, type !== "all" && `Tipo: ${type}`, recurrence !== "all" && `Recorrência: ${recurrence}`, query && `Busca: ${query}`].filter(Boolean) as string[];

  return <section className="transactions-page section-page">
    <SectionHeader eyebrow="CONTROLE" title="Movimentações" description="Consulte, filtre e organize entradas e saídas com rastreabilidade." actions={<><ExportButton label="Exportar" menu={<><button onClick={() => onExportXlsx(filtered, filters)}>Excel profissional (.xlsx)</button><button onClick={() => onExportCsv(filtered)}>CSV compatível</button></>} /><button className="primary-button" onClick={onNew}><Plus size={17}/>Novo lançamento</button></>} />

    <section className="filter-panel">
      <div className="filter-panel-title"><Filter size={17}/><span><strong>Filtros</strong><small>{filters.length ? `${filters.length} filtros ativos` : "Todos os registros"}</small></span><button onClick={clearFilters}><RotateCcw size={14}/>Limpar filtros</button></div>
      <div className="transaction-filters">
        <label className="search-field"><span>Buscar descrição</span><div><Search size={15}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Ex.: supermercado"/></div></label>
        <label><span>Data inicial</span><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }}/></label>
        <label><span>Data final</span><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }}/></label>
        <label><span>Categoria</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="all">Todas</option>{categories.map((item) => <option key={`${item.macro}-${item.name}`}>{item.name}</option>)}</select></label>
        <label><span>Conta</span><select value={account} onChange={(event) => { setAccount(event.target.value); setPage(1); }}><option value="all">Todas</option>{accounts.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label><span>Natureza</span><select value={macro} onChange={(event) => { setMacro(event.target.value); setPage(1); }}><option value="all">Todas</option><option>Receita</option><option>Fixo</option><option>Variável</option></select></label>
        <label><span>Entrada / saída</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="all">Todos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select></label>
        <label><span>Recorrência</span><select value={recurrence} onChange={(event) => { setRecurrence(event.target.value); setPage(1); }}><option value="all">Todas</option><option>Não</option><option>Mensal</option><option>Anual</option></select></label>
      </div>
    </section>

    <section className="transaction-summary">
      <div><span>Lançamentos</span><strong>{filtered.length}</strong></div>
      <div><span>Total de entradas</span><strong className="positive"><CurrencyValue value={income} hidden={hidden}/></strong></div>
      <div><span>Total de saídas</span><strong className="negative"><CurrencyValue value={expenses} hidden={hidden}/></strong></div>
      <div><span>Saldo filtrado</span><strong className={income - expenses >= 0 ? "positive" : "negative"}><CurrencyValue value={income - expenses} hidden={hidden}/></strong></div>
    </section>

    <article className="panel table-panel">
      <div className="table-toolbar"><span>{filtered.length ? `Exibindo ${Math.min((page - 1) * pageSize + 1, filtered.length)}–${Math.min(page * pageSize, filtered.length)} de ${filtered.length}` : "Nenhum resultado"}</span><label><ArrowDownAZ size={15}/><select value={`${sortKey}-${sortDirection}`} onChange={(event) => { const [key, direction] = event.target.value.split("-") as [SortKey, "asc" | "desc"]; setSortKey(key); setSortDirection(direction); }}><option value="date-desc">Data: mais recente</option><option value="date-asc">Data: mais antiga</option><option value="description-asc">Descrição: A–Z</option><option value="description-desc">Descrição: Z–A</option><option value="value-desc">Valor: maior primeiro</option><option value="value-asc">Valor: menor primeiro</option><option value="category-asc">Categoria: A–Z</option></select></label></div>
      {paged.length ? <>
        <div className="financial-table-wrap"><table className="financial-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Natureza</th><th>Conta</th><th>Recorrência</th><th className="numeric">Valor</th><th aria-label="Ações" /></tr></thead><tbody>{paged.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td><span className={`transaction-kind ${item.type}`}>{item.type === "entrada" ? <ArrowUpRight/> : <ArrowDownRight/>}</span><strong>{item.description}</strong>{Number(item.installmentTotal || 1) > 1 && <small>Parcela {item.installmentCurrent}/{item.installmentTotal}</small>}</td><td>{item.category}</td><td><StatusBadge tone={item.macro === "Receita" ? "positive" : item.macro === "Fixo" ? "info" : "attention"}>{item.macro}</StatusBadge></td><td>{item.account || "Não informado"}</td><td>{item.recurrence && item.recurrence !== "Não" ? <StatusBadge tone="neutral">{item.recurrence}</StatusBadge> : "—"}</td><td className={`numeric amount ${item.type}`}><CurrencyValue value={item.value} hidden={hidden}/></td><td><div className="row-actions"><button onClick={() => onEdit(item)} aria-label={`Editar ${item.description}`} title="Editar"><Pencil size={15}/></button><button className="danger" onClick={() => onArchive(item)} aria-label={`Arquivar ${item.description}`} title="Arquivar"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
        <div className="transaction-cards">{paged.map((item) => <article key={item.id}><div><span className={`transaction-kind ${item.type}`}>{item.type === "entrada" ? <ArrowUpRight/> : <ArrowDownRight/>}</span><span><strong>{item.description}</strong><small>{formatDate(item.date)} · {item.category}</small></span><b className={item.type}><CurrencyValue value={item.value} hidden={hidden}/></b></div><dl><div><dt>Natureza</dt><dd>{item.macro}</dd></div><div><dt>Conta</dt><dd>{item.account || "—"}</dd></div><div><dt>Recorrência</dt><dd>{item.recurrence || "Não"}</dd></div></dl><footer><button onClick={() => onEdit(item)}><Pencil size={14}/>Editar</button><button onClick={() => onArchive(item)}><Trash2 size={14}/>Arquivar</button></footer></article>)}</div>
        {pageCount > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Próxima</button></div>}
      </> : <EmptyState title="Nenhuma movimentação encontrada" description={filters.length ? "Ajuste ou limpe os filtros para ampliar a consulta." : "Cadastre seu primeiro lançamento para iniciar o fluxo de caixa."} action={<button className="text-button" onClick={filters.length ? clearFilters : onNew}>{filters.length ? "Limpar filtros" : "Adicionar lançamento"}</button>} />}
    </article>
  </section>;
}
