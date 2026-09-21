# Nexo Finanças Pessoais

Módulo independente de finanças pessoais em preparação para o **Portal Gestão Comercial**. Mantém a identidade Nexo, o Worker `financas-pessoais` e o D1 `financas-pessoais-db`. A integração com os outros módulos não foi realizada.

Documentação complementar: [revisão técnica](REVISAO.md) e [integração futura](INTEGRACAO_PORTAL.md).

## Funcionalidades

- Dashboard com indicadores, comparação mensal, projeções, orçamento, reserva e alertas calculados dos registros.
- Movimentações com cadastro, edição, arquivamento, parcelamento, filtros, pesquisa, ordenação e paginação.
- Categorias com edição, verificação de referências, exclusão e substituição.
- Planejamento de contas, cartões, metas, orçamentos e parcelas futuras.
- Patrimônio e investimentos com posições manuais, edição, exclusão e composição.
- Assinaturas com cadastro, filtros, vencimentos estimados e arquivamento.
- Relatório mensal, observações persistidas, Excel e impressão/PDF pelo navegador.
- Histórico de movimentações, snapshots, backup JSON e Excel completo com 11 abas.
- Perfil visual, tema, densidade, privacidade visual e preferências de exportação persistidos.
- Consultor integrado à OpenAI/Workers AI, com contexto do D1 e erros explícitos.

Não há dados financeiros demonstrativos injetados na interface. As categorias iniciais são configuração de partida; dados simulados ficam nos testes. Contas, metas, saldos, rentabilidade e patrimônio são informados manualmente. Não há conexão com bancos, corretoras ou cotações.

Recorrências classificam lançamentos e assinaturas estimam compromissos, sem gerar cobranças automaticamente. Parcelamento cria parcelas reais no D1. Contas/metas ainda não possuem edição na interface. A importação de movimentações existe na API; não há importador de arquivos nem restauração integral de backup na interface.

## Arquitetura e runtime

React 19 e TypeScript na interface; Vinext 0.0.50 sobre Vite 8, com APIs compatíveis com Next.js 16; runtime Cloudflare Workers com `nodejs_compat`; D1/SQLite para persistência; Drizzle para schema/migrations; Recharts, Lucide, ExcelJS e jose. As versões reproduzíveis estão em `package-lock.json`.

Fluxo: `app/page.tsx` → componentes/hooks → API → identidade/permissões → serviço financeiro → D1. Cálculos ficam em `lib/finance`; exportações em `lib/excel`. Queries usam parâmetros vinculados e `owner` obtido da identidade verificada.

```text
app/                       entrada, layout, CSS e fallback de erro
components/                telas, formulários, shell e componentes compartilhados
hooks/                     sincronização, navegação e foco de diálogos
lib/finance/               contratos, cálculos e CSV
lib/excel/                 exportações Excel
lib/ai/                    contratos/modelos de IA
worker/index.ts            roteamento e autorização
worker/identity.ts         adaptador de identidade e Principal
worker/finance.ts          persistência e operações financeiras
worker/validation.ts       validação e parcelamento
worker/http.ts             corpo limitado e erros HTTP
worker/advisor.ts          contexto e provedores IA
db/schema.ts               schema Drizzle
drizzle/                   migrations e snapshots
tests/                     regressões com SQLite, JWT e Excel
scripts/                   build, artefato e auditoria SQL
build/                     plugin Sites preservado
.github/workflows/         validação e publicação Cloudflare
wrangler.jsonc             runtime, bindings e banco existente
```

O destino atual é Workers, não Pages. `.openai/hosting.json` e o plugin Sites de empacotamento foram preservados. Não substitua o `database_id` nem crie recursos paralelos ao publicar este módulo.

## Instalação e execução local

Requisito: Node.js **22.13 ou superior** e npm. Os testes utilizam SQLite do Node.

```sh
npm ci
npm run cf:types
npm run cf:migrate:local
npm run dev
```

Abra `http://127.0.0.1:5173` ou a porta exibida. Os comandos npm funcionam em Windows/Linux/macOS sem Bash. O D1 local fica em `.wrangler/`, separado da produção; não apague essa pasta se precisar preservar seus dados locais.

Somente o Vite de desenvolvimento injeta `LOCAL_DEV_AUTH=true`. O Worker aceita essa identidade apenas em host loopback (`owner@local`). O build não injeta a flag; nunca a configure em produção.

Para configuração local opcional, copie `.dev.vars.example` para `.dev.vars`. No PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

O desenvolvimento padrão desabilita bindings remotos. Para testar Workers AI real, autentique Wrangler e inicie o processo com `FINANCE_REMOTE_AI=true`; isso usa a conta/cota Cloudflare. Uma chave OpenAI real também pode gerar consumo ao enviar perguntas. Os testes automatizados não precisam de provedores externos.

## Variáveis e bindings

| Nome | Uso |
| --- | --- |
| `DB` | D1 obrigatório `financas-pessoais-db`, configurado em `wrangler.jsonc` |
| `ASSETS`, `IMAGES` | Assets do build e otimização de imagens |
| `ACCESS_TEAM_DOMAIN` | Obrigatório em produção: `equipe.cloudflareaccess.com`, sem protocolo/caminho |
| `ACCESS_AUD` | Obrigatório em produção: Application Audience da aplicação Access |
| `LOCAL_DEV_AUTH` | Exclusivo do desenvolvimento loopback; injetado por Vite |
| `OPENAI_API_KEY` | Secret opcional, necessário para o provedor OpenAI |
| `OPENAI_MODEL` | Padrão atual do código: `gpt-5.4-mini`; exige acesso ao modelo na conta |
| `AI_PROVIDER` | Padrão do endpoint `openai`; opções `auto`, `cloudflare`, `cloudflare-qwen`, `cloudflare-mistral`, `cloudflare-gpt-oss` |
| `AI` | Binding Workers AI; modelos em `lib/ai/models.ts` |
| `ADVISOR_RATE_LIMITER` | Seis perguntas/minuto por proprietário e localidade Cloudflare |
| `FINANCE_REMOTE_AI` | Variável do processo Vite para permitir bindings remotos |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Secrets do GitHub Actions para publicar |

Não versione `.dev.vars`, chaves ou tokens. Nenhum segredo deve entrar em variáveis públicas do cliente.

## Autenticação e permissões

Proteja todos os domínios do Worker com Cloudflare Access, inclusive endereços alternativos `workers.dev`. Configure a política de usuários e as variáveis `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` no Worker **antes de publicar esta revisão**. Confirme a persistência das variáveis no ambiente de deploy escolhido.

O servidor verifica `cf-access-jwt-assertion`: assinatura RS256/JWKS, emissor, audiência, expiração e identidade. E-mail em cabeçalho isolado e cabeçalhos OAI legados não concedem acesso. Falta de configuração retorna `503`; token ausente/inválido retorna `401`, sem fallback público. O `owner` permanece o e-mail verificado para preservar os registros existentes.

O adaptador retorna `Principal` com `subject`, `owner` e escopos `finance:read`, `finance:write`, `finance:export`, `finance:advisor`. Usuários admitidos pelo Access recebem esses escopos apenas sobre seus próprios dados. Não há administração global, cadastro paralelo de senhas ou RBAC do Portal implantado. A autorização é checada no Worker; o futuro Portal fornecerá identidade estável e mapeamento de perfis.

## Banco e backup

Tabelas: `categories`, `transactions`, `investments`, `accounts`, `budgets`, `goals`, `wealth_items`, `subscriptions`, `transaction_events`, `monthly_notes`, `user_settings`, `financial_snapshots`, `backup_events`. Wrangler mantém adicionalmente seu controle de migrations.

Migrations `0000`…`0004` foram preservadas. `0005_module_integrity.sql` acrescenta índices, proteção de referências/duplicidades e auditoria transacional. `0006_category_cascade.sql` propaga alterações de categorias e impede macros inconsistentes. Não apagam dados antigos. Duplicidades legadas, se encontradas, precisam de conciliação explícita.

```sh
npx wrangler d1 migrations list DB --remote
npx wrangler d1 execute DB --local --file scripts/db-audit.sql
```

O script de auditoria contém somente SELECTs. Também pode ser executado remotamente; para obter resultados tabulares remotos, envie as consultas via `--command`, pois `--file` pode retornar só um resumo.

Backup JSON exporta todas as tabelas do proprietário em batch consistente, incluindo arquivados. Excel não é formato de restauração. O histórico registra geração/solicitação de exportação, sem comprovar salvamento no disco. Antes de migrations remotas, faça também backup administrativo do D1 ou registre ponto de recuperação. Não use rollback SQL destrutivo para reverter código.

## Build, testes e deploy

```sh
npm run cf:types
npm run typecheck
npm run lint
npm test
npx wrangler deploy --dry-run
```

`npm test` gera build, valida o Worker e executa a suíte. `npm run cf:dry-run` refaz o build e simula o pacote. Artefatos: `dist/server/index.js` e `dist/client`. Os scripts `.sh` antigos foram mantidos por compatibilidade; os comandos npm usam Node.

Publicação deliberada, após configurar Access, revisar backup e concluir os testes:

```sh
npx wrangler login
npm run cf:migrate
npm run cf:deploy
```

Os dois últimos comandos **alteram produção** e não foram executados nesta revisão. `cf:deploy` não aplica migrations: preserve a ordem. Na primeira liberação desta revisão, suspenda gravações durante migrations/deploy: a versão antiga ainda registra eventos pela API e pode duplicá-los enquanto coexistir com os novos triggers de auditoria. O workflow valida tipos/lint/build/testes antes de migrations e deploy em push na `main` ou disparo manual. Sem secrets ele informa que não publicou. O token de CI precisa das permissões apropriadas de Workers e D1.

## IA, exportações e limites conhecidos

O consultor envia dados ao provedor selecionado quando uma pergunta é enviada; não executa transações. Contexto vem do D1 do proprietário. Histórico limitado permanece na memória da tela; OpenAI recebe `store:false`. Status configurado não comprova resposta real. Não existe troca silenciosa de provedor. Modelos Workers AI compartilham limites da conta; não se promete gratuidade ilimitada.

CSV protege texto contra fórmulas; Excel grava descrições como texto, usa filtros sobre as linhas reais e respeita proprietário/assinatura. Ocultação visual não anonimiza backup/exportação nem representa controle de acesso.

- Access em produção e provedores reais de IA ainda precisam de validação operacional; os testes utilizam JWT/provedores isolados.
- Paginação é local e a API carrega o conjunto financeiro do proprietário. A tela limita eventos a 300, backups a 20 e snapshots aos 730 registros mais recentes; JSON completo não usa esses limites.
- Snapshots são posições observadas ao abrir/atualizar a aplicação. Não há reconstrução retroativa. Reserva usa heurística de nome/tipo, sem certificar liquidez.
- Cadastrar o mesmo bem em conta/carteira/patrimônio pode causar sobreposição. Não houve alteração arbitrária dessa regra de composição.
- Valores continuam `REAL` no D1 por compatibilidade. Entradas são validadas em centavos e parcelas preservam o total; eventual migração para inteiros exige conciliação.
- `npm audit` em 08/09/2026 aponta oito ocorrências transitivas (duas altas, seis moderadas). Veja exposição e decisões em `REVISAO.md`.
- Integração do Portal, restore, cobranças automáticas, edição de contas/metas, idempotência de reenvios e auditoria administrativa completa são trabalhos posteriores.
