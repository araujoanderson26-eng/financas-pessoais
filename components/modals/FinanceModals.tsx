"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, CalendarDays, CircleDollarSign, Layers3, Trash2, X } from "lucide-react";
import type { Account, Category, Investment, Transaction } from "@/lib/finance/types";
import { formatCurrency, localIsoDate } from "@/lib/formatters";

export type FinanceModal = "transaction" | "category" | "investment" | null;

function ModalFrame({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event)=>event.stopPropagation()}><header><div><span>{eyebrow}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header>{children}</div></div>;
}

function TransactionForm({ categories, accounts, editing, onSubmit, onClose }: { categories:Category[]; accounts:Account[]; editing:Transaction|null; onSubmit:(event:FormEvent<HTMLFormElement>)=>void; onClose:()=>void }) {
  const [category,setCategory]=useState(editing?.category||categories[0]?.name||"");
  const [value,setValue]=useState(editing?.value||0);
  const [installments,setInstallments]=useState(editing?.installmentTotal||1);
  const nature=categories.find((item)=>item.name===category)?.macro||editing?.macro||"Variável";
  return <ModalFrame eyebrow="MOVIMENTAÇÃO" title={editing?"Editar lançamento":"Novo lançamento"} onClose={onClose}><form className="form-grid premium-form" onSubmit={onSubmit}><section><h3><CircleDollarSign/>Dados principais</h3><div><label>Tipo<select name="type" defaultValue={editing?.type||"saida"} required><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label><label>Data<input name="date" type="date" defaultValue={editing?.date||localIsoDate()} required/></label><label className="full">Descrição<input name="description" defaultValue={editing?.description||""} placeholder="Ex.: Supermercado" required/></label><label>Categoria<select name="category" value={category} onChange={(event)=>setCategory(event.target.value)} required>{categories.map((item)=><option key={`${item.macro}-${item.name}`}>{item.name}</option>)}</select></label><label>Natureza<input name="macro" value={nature} readOnly aria-readonly="true"/></label><label>Valor total<input name="value" type="number" min="0.01" step="0.01" value={value||""} onChange={(event)=>setValue(Number(event.target.value))} placeholder="0,00" required/></label><label>Conta<select name="account" defaultValue={editing?.account||"Não informado"}><option>Não informado</option>{accounts.map((item)=><option key={item.id}>{item.name}</option>)}</select></label></div></section><section><h3><CalendarDays/>Recorrência e parcelamento</h3><div><label>Recorrência<select name="recurrence" defaultValue={editing?.recurrence||"Não"}><option>Não</option><option>Mensal</option><option>Anual</option><option>Personalizada</option></select></label>{!editing&&<label>Número de parcelas<input name="installmentTotal" type="number" min="1" max="120" value={installments} onChange={(event)=>setInstallments(Math.max(1,Number(event.target.value)))}/></label>}</div>{!editing&&installments>1&&<div className="installment-preview"><Layers3/><span><strong>{installments} parcelas de aproximadamente {formatCurrency(value/installments)}</strong><small>Primeira em {new Intl.DateTimeFormat('pt-BR').format(new Date())} · total comprometido {formatCurrency(value)}</small></span></div>}</section><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">{editing?"Salvar alterações":"Salvar lançamento"}</button></footer></form></ModalFrame>;
}

export function FinanceModals({ modal, categories, accounts, editingTransaction, editingCategory, editingInvestment, onClose, onTransaction, onCategory, onInvestment }: {
  modal:FinanceModal; categories:Category[]; accounts:Account[]; editingTransaction:Transaction|null; editingCategory:Category|null; editingInvestment:Investment|null; onClose:()=>void; onTransaction:(event:FormEvent<HTMLFormElement>)=>void; onCategory:(event:FormEvent<HTMLFormElement>)=>void; onInvestment:(event:FormEvent<HTMLFormElement>)=>void;
}) {
  if(!modal)return null;
  if(modal==="transaction")return <TransactionForm key={editingTransaction?.id||"new-transaction"} categories={categories} accounts={accounts} editing={editingTransaction} onSubmit={onTransaction} onClose={onClose}/>;
  if(modal==="category")return <ModalFrame eyebrow="CLASSIFICAÇÃO" title={editingCategory?"Editar categoria":"Nova categoria"} onClose={onClose}><form key={editingCategory?.id||"new-category"} className="form-grid premium-form" onSubmit={onCategory}><section><div><label className="full">Nome<input name="name" defaultValue={editingCategory?.name||""} placeholder="Ex.: Assinaturas" required/></label><label className="full">Macrocategoria<select name="macro" defaultValue={editingCategory?.macro||"Fixo"} required><option>Fixo</option><option>Variável</option><option>Receita</option></select></label></div></section><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">{editingCategory?"Salvar alterações":"Criar categoria"}</button></footer></form></ModalFrame>;
  return <ModalFrame eyebrow="INVESTIMENTOS" title={editingInvestment?"Editar investimento":"Novo investimento"} onClose={onClose}><form className="form-grid premium-form" onSubmit={onInvestment}><section><div><label className="full">Investimento<input name="name" defaultValue={editingInvestment?.name||""} placeholder="Ex.: Tesouro Selic" required/></label><label>Classe<input name="type" list="investment-types" defaultValue={editingInvestment?.type||"Renda fixa"} required/><datalist id="investment-types"><option>Renda fixa</option><option>Fundos</option><option>Ações</option><option>Previdência</option><option>Internacional</option><option>Imóveis</option><option>Outros</option></datalist></label><label>Valor<input name="value" type="number" min="0.01" step="0.01" defaultValue={editingInvestment?.value} required/></label><label className="full">Rentabilidade acumulada (%)<input name="returnPct" type="number" step="0.1" defaultValue={editingInvestment?.returnPct||0}/></label></div></section><footer><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">{editingInvestment?"Salvar alterações":"Salvar investimento"}</button></footer></form></ModalFrame>;
}

export function CategoryDeleteDialog({ category, categories, replacementId, busy, onReplacementChange, onCancel, onConfirm }: {
  category: Category | null;
  categories: Category[];
  replacementId: string;
  busy: boolean;
  onReplacementChange: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!category) return null;
  const transactionCount = Number(category.transactionCount || 0);
  const referenceCount = Number(category.referenceCount ?? transactionCount + Number(category.budgetCount || 0) + Number(category.subscriptionCount || 0));
  const replacements = categories.filter((item) => item.id !== category.id);
  const hasReferences = referenceCount > 0;
  return <div className="modal-backdrop" role="presentation">
    <div className="confirm-dialog category-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="category-delete-title">
      <span className={hasReferences ? "attention" : "danger"}>{hasReferences ? <AlertTriangle/> : <Trash2/>}</span>
      <h2 id="category-delete-title">Excluir categoria “{category.name}”?</h2>
      {hasReferences ? <>
        <p>{transactionCount > 0 ? `Esta categoria possui ${transactionCount} ${transactionCount === 1 ? "lançamento vinculado" : "lançamentos vinculados"}.` : "Esta categoria possui referências vinculadas."} Escolha outra categoria para preservar e transferir todos os registros antes da exclusão.</p>
        {replacements.length ? <label className="category-replacement">Mover lançamentos e referências para
          <select value={replacementId} onChange={(event) => onReplacementChange(event.target.value)} required>
            <option value="">Selecione uma categoria</option>
            {replacements.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.macro}</option>)}
          </select>
        </label> : <p className="category-delete-blocked">Crie outra categoria antes de excluir esta. Nenhum lançamento será apagado.</p>}
      </> : <p>A categoria não possui lançamentos, orçamentos ou assinaturas vinculados.</p>}
      <div>
        <button className="secondary-button" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className="danger-button" onClick={onConfirm} disabled={busy || (hasReferences && (!replacementId || !replacements.length))}>{busy ? "Processando..." : hasReferences ? "Mover e excluir categoria" : "Excluir categoria"}</button>
      </div>
    </div>
  </div>;
}
