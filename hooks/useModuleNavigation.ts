"use client";
import { useSyncExternalStore } from 'react';
import type { Tab } from '@/lib/finance/types';

const tabs = new Set<Tab>(['dashboard','movimentos','planejamento','patrimonio','categorias','investimentos','assinaturas','relatorio','historico','consultor','configuracoes']);
const subscribe = (listener: () => void) => { window.addEventListener('hashchange',listener); return () => window.removeEventListener('hashchange',listener); };
const current = (): Tab => { const value = window.location.hash.slice(1) as Tab; return tabs.has(value) ? value : 'dashboard'; };
/** Standalone navigation adapter. The Portal can replace this hook with its router. */
export function useModuleNavigation() {
  const tab = useSyncExternalStore(subscribe, current, () => 'dashboard' as Tab);
  return [tab, (value: Tab) => { window.location.hash = value; }] as const;
}
