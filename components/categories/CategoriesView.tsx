"use client";

import { ArrowUpRight, BarChart3, Plus, Tags, Target } from "lucide-react";
import type { Category, Transaction } from "@/lib/finance/types";
import { EmptyState, PanelHeader, SectionHeader } from "@/components/shared";

export function CategoriesView({ categories, transactions, onNew }: { categories: Category[]; transactions: Transaction[]; onNew: () => void }) {
  return <section className="categories-page section-page"><SectionHeader eyebrow="CATEGORIAS" title="Estrutura financeira" description="Classificações consistentes tornam comparações, orçamentos e insights mais confiáveis." actions={<button className="primary-button" onClick={onNew}><Plus size={16}/>Nova categoria</button>}/><div className="category-grid">{["Receita","Fixo","Variável"].map((macro)=><article className="panel" key={macro}><PanelHeader eyebrow="MACROCATEGORIA" title={macro}/><div className={`category-symbol ${macro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}`}>{macro==="Receita"?<ArrowUpRight/>:macro==="Fixo"?<Target/>:<BarChart3/>}</div><div className="category-list">{categories.filter((item)=>item.macro===macro).length?categories.filter((item)=>item.macro===macro).map((item)=><div key={item.name}><span><Tags/><strong>{item.name}</strong></span><small>{transactions.filter((transaction)=>transaction.category===item.name).length} lançamentos</small></div>):<EmptyState compact title={`Nenhuma categoria ${macro.toLowerCase()}`} description="Adicione uma classificação personalizada para começar."/>}</div></article>)}</div></section>;
}
