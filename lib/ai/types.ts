export type AdvisorMessage = { role: "user" | "assistant"; content: string };
export type AdvisorStatus = {
  configured: boolean;
  provider: "openai" | "cloudflare" | null;
  model: string | null;
};
export type AdvisorAnswer = AdvisorStatus & { answer: string };
