import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Binding Cloudflare D1 `DB` indisponível. Confira d1_databases no wrangler.jsonc e aplique as migrations no ambiente selecionado."
    );
  }

  return drizzle(env.DB, { schema });
}
