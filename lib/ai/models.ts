import type { AdvisorStatus } from "./types";

// IDs are shared by the picker and the server allowlist. Keep "cloudflare"
// as the Llama alias for existing clients.
export const CLOUDFLARE_MODELS = [
  { id: "cloudflare", name: "Llama 3.3 70B", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", maxTokens: 1600 },
  { id: "cloudflare-qwen", name: "Qwen3 30B", model: "@cf/qwen/qwen3-30b-a3b-fp8", maxTokens: 4096 },
  { id: "cloudflare-mistral", name: "Mistral Small 3.1", model: "@cf/mistralai/mistral-small-3.1-24b-instruct", maxTokens: 1600 },
  { id: "cloudflare-gpt-oss", name: "GPT-OSS 20B (OpenAI)", model: "@cf/openai/gpt-oss-20b", maxTokens: 4096 },
] as const;

export type AdvisorProvider = "openai" | typeof CLOUDFLARE_MODELS[number]["id"];
export const DEFAULT_ADVISOR_PROVIDER: AdvisorProvider = "cloudflare";

export function cloudflareModel(id: unknown) {
  return CLOUDFLARE_MODELS.find((option) => option.id === id);
}

export function isAdvisorProvider(id: unknown): id is AdvisorProvider {
  return id === "openai" || cloudflareModel(id) !== undefined;
}

export function advisorLabel(status: AdvisorStatus) {
  if (status.provider === "openai") return "OpenAI";
  return CLOUDFLARE_MODELS.find((option) => option.model === status.model)?.name || "Cloudflare AI";
}
