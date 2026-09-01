"use client";

import { ArrowUpRight, BarChart3, Pencil, Plus, Tags, Target, Trash2 } from "lucide-react";
import type { Category, FinancialMacro, Transaction } from "@/lib/finance/types";
import { EmptyState, PanelHeader, SectionHeader } from "@/components/shared";

const macros: FinancialMacro[] = ["Receita", "Fixo", "Variável"];
const categoryOrder = new Intl.Collator("pt-BR", { sensitivity: "base" });

export function CategoriesView({ categories, transactions, onNew, onEdit, onDelete }: {
  categories: Category[];
  transactions: Transaction[];
  onNew: () => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return <section className="categories-page section-page">
    <SectionHeader
      eyebrow="CATEGORIAS"
      title="Estrutura financeira"
      description="Classificações consistentes tornam comparações, orçamentos e insights mais confiáveis."
      actions={<button className="primary-button" onClick={onNew}><Plus size={16}/>Nova categoria</button>}
    />
    <div className="category-grid">
      {macros.map((macro) => {
        const groupedCategories = categories
          .filter((item) => item.macro === macro)
          .sort((left, right) => categoryOrder.compare(left.name, right.name));
        return <article className="panel" key={macro}>
          <PanelHeader eyebrow="MACROCATEGORIA" title={macro}/>
          <div className={`category-symbol ${macro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>
            {macro === "Receita" ? <ArrowUpRight/> : macro === "Fixo" ? <Target/> : <BarChart3/>}
          </div>
          <div className="category-list">
            {groupedCategories.length ? groupedCategories.map((item) => {
              const transactionCount = Number(item.transactionCount ?? transactions.filter((transaction) => transaction.category === item.name).length);
              return <div key={item.id}>
                <span className="category-list-main">
                  <Tags/>
                  <span><strong>{item.name}</strong><small>{transactionCount} {transactionCount === 1 ? "lançamento" : "lançamentos"}</small></span>
                </span>
                <div className="row-actions">
                  <button onClick={() => onEdit(item)} aria-label={`Editar categoria ${item.name}`} title="Editar"><Pencil size={14}/></button>
                  <button className="danger" onClick={() => onDelete(item)} aria-label={`Excluir categoria ${item.name}`} title="Excluir"><Trash2 size={14}/></button>
                </div>
              </div>;
            }) : <EmptyState compact title={`Nenhuma categoria ${macro.toLowerCase()}`} description="Adicione uma classificação personalizada para começar."/>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
