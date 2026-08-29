"use client";

import { useState, type FormEvent } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
type Message = { role: "ai" | "user"; text: string };

export function AdvisorView({ analytics, onAsk }: { analytics: Analytics; onAsk: (question: string) => Promise<string> }) {
  const [question,setQuestion]=useState("");
  const [loading,setLoading]=useState(false);
  const [chat,setChat]=useState<Message[]>([{role:"ai",text:"Posso analisar somente os dados registrados no Nexo. O que você quer entender primeiro?"}]);
  const prompts = ["Por que minhas despesas aumentaram?","Quanto consigo poupar?","Minha reserva está adequada?","Qual categoria cresceu mais?","Como está meu patrimônio?","Quanto está comprometido no próximo mês?"];
  async function submit(event:FormEvent){event.preventDefault();const value=question.trim();if(!value||loading)return;setQuestion("");setChat((current)=>[...current,{role:"user",text:value}]);setLoading(true);try{const answer=await onAsk(value);setChat((current)=>[...current,{role:"ai",text:answer}]);}finally{setLoading(false);}}
  return <section className="advisor-page"><div className="advisor-intro"><span className="advisor-seal"><Bot/></span><span className="eyebrow">CONSULTOR IA</span><h1>Perguntas melhores.<br/>Decisões mais claras.</h1><p>O consultor usa exclusivamente os números registrados, sem inventar dados e sem substituir orientação financeira profissional.</p><div className="quick-prompts">{prompts.map((prompt)=><button key={prompt} onClick={()=>setQuestion(prompt)}>{prompt}</button>)}</div><div className="advisor-context"><Sparkles/><span><strong>Contexto atual</strong><small>{analytics.totals.count} lançamentos no período · {analytics.healthFactors.length} fatores disponíveis para análise</small></span></div></div><article className="chat-card"><header><span><Sparkles/><strong>Análise inteligente</strong></span><small><i/>Dados do Nexo</small></header><div className="chat-messages">{chat.map((message,index)=><div className={`message ${message.role}`} key={`${message.role}-${index}`}>{message.role==="ai"&&<span><Bot/></span>}<p>{message.text}</p></div>)}{loading&&<div className="message ai loading-message"><span><Bot/></span><p><i/><i/><i/></p></div>}</div><form onSubmit={submit}><input value={question} onChange={(event)=>setQuestion(event.target.value)} placeholder="Pergunte sobre sua vida financeira..." aria-label="Pergunta ao Consultor IA"/><button disabled={loading} aria-label="Enviar pergunta"><Send/></button></form><footer>Indicador educacional baseado nos registros. Avalie riscos e decisões com profissionais qualificados quando necessário.</footer></article></section>;
}
