"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, RotateCcw, Send, Sparkles } from "lucide-react";
import type { getFinancialAnalytics } from "@/lib/finance/analytics";
import { formatMonth } from "@/lib/formatters";
import { askAdvisor, recentHistory } from "@/lib/ai/client";
import type { AdvisorMessage, AdvisorStatus } from "@/lib/ai/types";
import { CLOUDFLARE_MODELS, DEFAULT_ADVISOR_PROVIDER, advisorLabel, isAdvisorProvider, type AdvisorProvider } from "@/lib/ai/models";

type Analytics = ReturnType<typeof getFinancialAnalytics>;
type Message = AdvisorMessage & { provider?: string };
const prompts = ["Faça uma análise completa do mês e proponha três ações.", "Por que minhas despesas aumentaram?", "Quanto consigo poupar?", "Minha reserva está adequada?", "Qual categoria cresceu mais?", "Quanto está comprometido no próximo mês?"];

export function AdvisorView({ analytics, month }: { analytics: Analytics; month: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AdvisorStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AdvisorProvider>(DEFAULT_ADVISOR_PROVIDER);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/advisor?provider=${selectedProvider}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok || response.redirected) throw new Error("Entre novamente no site para verificar a conexão com a IA.");
        return response.json() as Promise<AdvisorStatus>;
      })
      .then((result) => { if (!controller.signal.aborted) setStatus(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível verificar a IA."); });
    return () => controller.abort();
  }, [selectedProvider]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [chat, loading, error]);

  async function send(value: string) {
    if (!value.trim() || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setLoading(true);
    const pending: Message = { role: "user", content: value.trim() };
    setChat([...chat, pending]);
    setQuestion("");
    try {
      const result = await askAdvisor(pending.content, month, recentHistory(chat), selectedProvider);
      setChat([...chat, pending, { role: "assistant", content: result.answer, provider: advisorLabel(result) }]);
      setStatus(result);
      setConnected(true);
    } catch (cause) {
      setChat(chat);
      setQuestion(value);
      setConnected(false);
      setError(cause instanceof Error ? cause.message : "Não foi possível obter a resposta.");
    } finally { inFlight.current = false; setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(question); }
  const statusLabel = !status ? error ? "Conexão indisponível" : "Verificando conexão" : !status.configured ? "IA não configurada" : `${advisorLabel(status)} · ${connected ? "conectado" : "configurado"}`;

  return <section className="advisor-page">
    <div className="advisor-intro">
      <span className="advisor-seal"><Bot/></span><span className="eyebrow">ASSISTENTE IA</span>
      <h1>Perguntas melhores.<br/>Decisões mais claras.</h1>
      <p>Converse sobre seus gastos, metas e investimentos. A análise consulta seus registros salvos e considera as mensagens desta conversa.</p>
      <label className="advisor-provider">Escolha a inteligência artificial<select aria-label="Inteligência artificial" value={selectedProvider} disabled={loading} onChange={(event) => { const value = event.target.value; if (!isAdvisorProvider(value)) return; setSelectedProvider(value); setStatus(null); setConnected(false); setChat([]); setError(null); }}>
        <optgroup label="Cota gratuita compartilhada · sem chave extra">{CLOUDFLARE_MODELS.map((option) => <option key={option.id} value={option.id}>{option.name} · Cloudflare</option>)}</optgroup>
        <optgroup label="API paga"><option value="openai">OpenAI · requer chave e créditos</option></optgroup>
      </select></label>
      {selectedProvider !== "openai" && <p className="advisor-privacy">Llama, Qwen e Mistral funcionam pelo Cloudflare, sem novas chaves. Compartilham a mesma cota gratuita diária; trocar de modelo não renova a cota. Em contas Cloudflare pagas, excedentes podem ser cobrados. <a href="https://developers.cloudflare.com/workers-ai/platform/pricing/" target="_blank" rel="noreferrer">Consultar limites</a>.</p>}
      <div className="quick-prompts">{prompts.map((prompt) => <button key={prompt} disabled={loading} onClick={() => void send(prompt)}>{prompt}</button>)}</div>
      <div className="advisor-context"><Sparkles/><span><strong>{formatMonth(month)}</strong><small>{analytics.totals.count} lançamentos no mês · comparação com meses anteriores</small></span></div>
      <p className="advisor-privacy">Ao enviar uma pergunta, os dados financeiros necessários e as mensagens são enviados ao provedor indicado. A conversa permanece nesta tela até você sair ou iniciar outra.</p>
      {status && !status.configured && <p role="status" className="advisor-setup">{selectedProvider === "openai" ? "Configure a chave da OpenAI nos segredos do Cloudflare, ou escolha uma opção com cota gratuita acima. O login do ChatGPT, gratuito ou pago, não inclui créditos da API." : "A conexão Cloudflare AI ainda não está disponível. Confira o binding AI na configuração do Worker."}</p>}
    </div>
    <article className="chat-card">
      <header><span><Sparkles/><strong>Conversa financeira</strong></span><small className={connected ? "ai-connected" : "ai-pending"}><i/>{statusLabel}</small><button type="button" className="advisor-reset" disabled={loading || chat.length === 0} aria-label="Iniciar nova conversa" title="Nova conversa" onClick={() => { setChat([]); setError(null); setQuestion(""); }}><RotateCcw size={16}/></button></header>
      <div className="chat-messages" role="log" aria-label="Conversa com a IA" aria-live="polite" aria-busy={loading}>
        {!chat.length && <div className="message ai"><span><Bot/></span><p>O que você quer entender sobre suas finanças de {formatMonth(month)}? Você pode pedir uma análise mensal ou fazer uma pergunta específica.</p></div>}
        {chat.map((message, index) => <div className={`message ${message.role === "assistant" ? "ai" : "user"}`} key={index}>{message.role === "assistant" && <span><Bot/></span>}<div className="message-body"><p>{message.content}</p>{message.provider && <small>{message.provider}</small>}</div></div>)}
        {loading && <div className="message ai loading-message"><span><Bot/></span><p aria-label="Analisando seus registros"><i/><i/><i/></p></div>}
        {error && <div className="advisor-error" role="alert"><strong>Não consegui concluir a análise.</strong><p>{error}</p><span>Sua pergunta continua no campo abaixo para tentar novamente.</span></div>}
        <div ref={messagesEnd}/>
      </div>
      <form onSubmit={submit}><input value={question} maxLength={2000} disabled={loading} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte sobre sua vida financeira..." aria-label="Pergunta ao Assistente IA"/><button disabled={loading || !question.trim()} aria-label="Enviar pergunta"><Send/></button></form>
      <footer>Análise educativa. A IA pode errar; confira os valores antes de decidir.</footer>
    </article>
  </section>;
}
