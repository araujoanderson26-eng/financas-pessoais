"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CircleDollarSign,
  CreditCard,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Landmark,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  Repeat2,
  Search,
  Settings,
  Tags,
  TrendingUp,
  X,
} from "lucide-react";
import type { SyncState } from "@/hooks/useFinanceData";
import type { Tab, UserSettings } from "@/lib/finance/types";
import { formatMonth } from "@/lib/formatters";

const controlNav = [
  { id: "dashboard" as Tab, label: "Visão geral", icon: LayoutDashboard },
  { id: "movimentos" as Tab, label: "Movimentações", icon: CreditCard },
  { id: "planejamento" as Tab, label: "Planejamento", icon: PiggyBank },
  { id: "patrimonio" as Tab, label: "Patrimônio", icon: Landmark },
  { id: "categorias" as Tab, label: "Categorias", icon: Tags },
  { id: "investimentos" as Tab, label: "Investimentos", icon: TrendingUp },
  { id: "assinaturas" as Tab, label: "Assinaturas", icon: Repeat2 },
  { id: "relatorio" as Tab, label: "Relatório mensal", icon: FileText },
  { id: "historico" as Tab, label: "Histórico e backup", icon: FileDown },
];

export type GlobalSearchItem = { id: string; label: string; meta: string; tab: Tab };

export function AppShell({
  active,
  onNavigate,
  selectedMonth,
  syncState,
  settings,
  alertCount,
  searchItems,
  onNewTransaction,
  onTogglePrivacy,
  children,
}: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  selectedMonth: string;
  syncState: SyncState;
  settings: UserSettings;
  alertCount: number;
  searchItems: GlobalSearchItem[];
  onNewTransaction: () => void;
  onTogglePrivacy: () => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (normalized.length < 2) return [];
    return searchItems.filter((item) => `${item.label} ${item.meta}`.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 8);
  }, [query, searchItems]);
  const syncLabel = syncState === "saved" ? "Dados salvos" : syncState === "saving" ? "Salvando" : syncState === "loading" ? "Conectando" : syncState === "local" ? "Modo local" : "Erro de sincronização";

  function navigate(tab: Tab) {
    onNavigate(tab);
    setMenuOpen(false);
    setQuery("");
  }

  return (
    <div className="app-shell">
      <button className={`drawer-overlay ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} aria-label="Fechar navegação" />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark"><CircleDollarSign size={24} /></div>
          <div><strong>Nexo</strong><span>Finanças pessoais</span><small>by Anderson de Araujo</small></div>
        </div>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        <nav>
          <p>CONTROLE</p>
          {controlNav.map((item) => <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => navigate(item.id)} aria-current={active === item.id ? "page" : undefined}><item.icon size={18} />{item.label}</button>)}
          <p>INTELIGÊNCIA</p>
          <button className={`${active === "consultor" ? "active " : ""}ai-nav`} onClick={() => navigate("consultor")} aria-current={active === "consultor" ? "page" : undefined}><Bot size={18} />Consultor IA<span>IA</span></button>
          <p>SISTEMA</p>
          <button className={active === "configuracoes" ? "active" : ""} onClick={() => navigate("configuracoes")} aria-current={active === "configuracoes" ? "page" : undefined}><Settings size={18} />Configurações</button>
        </nav>
        <div className="sidebar-profile"><div>AA</div><span><strong>Anderson de Araujo</strong><small>Conta pessoal</small></span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button>
          <div className={`sync-state ${syncState}`} title={syncLabel}><i />{syncLabel}</div>
          <div className="global-search">
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar no Nexo" aria-label="Pesquisa global" />
            {results.length > 0 && <div className="search-results">{results.map((item) => <button key={item.id} onClick={() => navigate(item.tab)}><span>{item.label}</span><small>{item.meta}</small></button>)}</div>}
          </div>
          <span className="topbar-period">{formatMonth(selectedMonth)}</span>
          <button className="icon-button privacy-toggle" onClick={onTogglePrivacy} aria-label={settings.hideValues ? "Exibir valores" : "Ocultar valores"} title={settings.hideValues ? "Exibir valores" : "Ocultar valores"}>{settings.hideValues ? <EyeOff /> : <Eye />}</button>
          <button className="icon-button alerts-button" onClick={() => navigate("dashboard")} aria-label={`${alertCount} alertas financeiros`} title="Alertas financeiros"><Bell />{alertCount > 0 && <span>{alertCount}</span>}</button>
          <button className="primary-button topbar-new" onClick={onNewTransaction}><Plus size={17} />Novo lançamento</button>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
