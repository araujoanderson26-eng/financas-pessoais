"use client";

import type { FormEvent } from "react";
import { Check, Cloud, Database, Download, Eye, FileSpreadsheet, Languages, LayoutGrid, Moon, Palette, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import type { BackupEvent, UserSettings } from "@/lib/finance/types";
import { formatDateTime } from "@/lib/formatters";
import { PanelHeader, SectionHeader, StatusBadge } from "@/components/shared";

export function SettingsView({ settings, lastBackup, syncState, onPatch, onSaveProfile, onBackupJson, onFullExcel }: {
  settings: UserSettings;
  lastBackup?: BackupEvent;
  syncState: string;
  onPatch: (patch: Partial<UserSettings>) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onBackupJson: () => void;
  onFullExcel: () => void;
}) {
  const exports = [
    ["exportIdentity","Identidade Nexo","Inclui nome do produto e assinatura."],
    ["exportOwner","Nome do proprietário","Exibe Anderson de Araujo no cabeçalho."],
    ["exportGeneratedAt","Data de geração","Registra data e hora do arquivo."],
    ["exportTotals","Totais","Adiciona resumos e linhas de totalização."],
    ["exportFilters","Filtros","Documenta o recorte aplicado."],
    ["exportFreezeHeader","Cabeçalho congelado","Mantém títulos visíveis ao rolar."],
  ] as const;
  return <section className="settings-page section-page"><SectionHeader eyebrow="SISTEMA" title="Configurações" description="Personalize aparência, privacidade, identidade e padrão das exportações."/>
    <div className="settings-layout">
      <article className="panel settings-card"><PanelHeader eyebrow="PERFIL" title="Identidade do produto" action={<UserRound/>}/><form className="settings-form" onSubmit={onSaveProfile} key={settings.updatedAt || "profile"}><label>Nome<input name="profileName" defaultValue={settings.profileName} required/></label><label>Produto<input name="productName" defaultValue={settings.productName} required/></label><label>Assinatura<input name="signature" defaultValue={settings.signature} required/></label><button className="primary-button" type="submit"><Save size={15}/>Salvar perfil</button></form></article>
      <article className="panel settings-card"><PanelHeader eyebrow="REGIONALIZAÇÃO" title="Formato brasileiro" action={<Languages/>}/><div className="regional-grid"><div><span>Moeda</span><strong>BRL · Real brasileiro</strong></div><div><span>Idioma</span><strong>Português Brasil</strong></div><div><span>Datas</span><strong>DD/MM/AAAA</strong></div></div><p className="settings-note"><Check/>Padrão aplicado a telas, relatórios e arquivos.</p></article>
      <article className="panel settings-card settings-wide"><PanelHeader eyebrow="APARÊNCIA" title="Tema e densidade" action={<Palette/>}/><div className="appearance-groups"><div><span>Tema</span><div className="choice-grid theme-choice">{([['light','Claro',Sun],['dark','Escuro',Moon],['system','Sistema',LayoutGrid]] as const).map(([value,label,Icon])=><button key={value} className={settings.theme===value?"selected":""} onClick={()=>onPatch({theme:value})}><Icon/><strong>{label}</strong><small>{value==='system'?'Segue o dispositivo':value==='dark'?'Grafite e verde adaptado':'Fundo claro e sóbrio'}</small>{settings.theme===value&&<Check/>}</button>)}</div></div><div><span>Densidade</span><div className="density-choice"><button className={settings.density==='comfortable'?"selected":""} onClick={()=>onPatch({density:'comfortable'})}><strong>Confortável</strong><small>Mais respiro e leitura</small></button><button className={settings.density==='compact'?"selected":""} onClick={()=>onPatch({density:'compact'})}><strong>Compacta</strong><small>Mais dados por tela</small></button></div></div></div></article>
      <article className="panel settings-card"><PanelHeader eyebrow="PRIVACIDADE" title="Ocultar valores" action={<Eye/>}/><p>Substitui valores sensíveis por marcadores no dashboard e nas principais telas.</p><label className="switch-row"><span><strong>Ocultar valores financeiros</strong><small>A preferência persiste no D1.</small></span><input type="checkbox" checked={settings.hideValues} onChange={(event)=>onPatch({hideValues:event.target.checked})}/><i/></label></article>
      <article className="panel settings-card settings-wide"><PanelHeader eyebrow="EXPORTAÇÕES" title="Padrão dos relatórios" action={<FileSpreadsheet/>}/><div className="export-settings">{exports.map(([key,title,description])=><label key={key}><input type="checkbox" checked={settings[key]} onChange={(event)=>onPatch({[key]:event.target.checked})}/><span><strong>{title}</strong><small>{description}</small></span><i><Check/></i></label>)}</div></article>
      <article className="panel settings-card settings-wide"><PanelHeader eyebrow="DADOS E SEGURANÇA" title="Persistência e cópias" action={<ShieldCheck/>}/><div className="data-status"><div><Cloud/><span><small>Sincronização</small><strong>{syncState}</strong></span><StatusBadge tone={syncState.includes('salvos')?'positive':'attention'}>{syncState}</StatusBadge></div><div><Database/><span><small>Banco</small><strong>financas-pessoais-db</strong></span><StatusBadge tone="positive">D1 existente</StatusBadge></div><div><Download/><span><small>Último backup</small><strong>{lastBackup?formatDateTime(lastBackup.createdAt):'Ainda não registrado'}</strong></span><StatusBadge tone="neutral">{lastBackup?.kind||'Pendente'}</StatusBadge></div></div><div className="settings-backup-actions"><button className="secondary-button" onClick={onBackupJson}><Download size={16}/>Backup JSON</button><button className="primary-button" onClick={onFullExcel}><FileSpreadsheet size={16}/>Excel completo</button></div><p className="settings-note"><ShieldCheck/>Ações destrutivas exigem confirmação específica. Não existe atalho para apagar todos os dados.</p></article>
    </div>
  </section>;
}
