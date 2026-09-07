import type { AdvisorAnswer, AdvisorMessage } from "./types";

export async function askAdvisor(question: string, month: string, history: AdvisorMessage[], provider: "openai" | "cloudflare" = "openai"): Promise<AdvisorAnswer> {
  let response: Response;
  try {
    response = await fetch(`/api/advisor?provider=${provider}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, month, history }), signal: AbortSignal.timeout(70_000),
    });
  } catch {
    throw new Error("A conexão com a IA foi interrompida ou demorou demais. Tente novamente.");
  }
  if (response.status === 401 || response.redirected) throw new Error("Sua sessão expirou. Entre novamente no site para continuar.");
  const result = await response.json().catch(() => null) as (AdvisorAnswer & { error?: string }) | null;
  if (!response.ok || !result?.answer) throw new Error(result?.error || "Não foi possível concluir a análise. Tente novamente.");
  return result;
}

export function recentHistory(messages: AdvisorMessage[]): AdvisorMessage[] {
  const selected: AdvisorMessage[] = [];
  let size = 0;
  for (const message of messages.slice(-10).reverse()) {
    const content = message.content.slice(0, 6000);
    if (size + content.length > 16_000) break;
    selected.unshift({ ...message, content });
    size += content.length;
  }
  while (selected[0]?.role === "assistant") selected.shift();
  return selected;
}
