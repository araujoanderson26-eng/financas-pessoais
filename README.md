# Nexo Finanças Pessoais

Aplicação pessoal de gestão financeira com visão executiva, analytics, planejamento, relatórios e exportações profissionais. A produção usa o Worker existente `financas-pessoais` e o D1 existente `financas-pessoais-db`.

## O que está incluído

- Dashboard executivo com score de saúde financeira, reserva, projeção, alertas, insights e comparações
- Fluxo de caixa, evolução patrimonial por snapshots, despesas por categoria e orçado × realizado
- Movimentações com filtros combináveis, busca, ordenação, resumos e paginação responsiva
- Planejamento com contas, cartões, metas, recorrências, orçamentos e parcelamentos futuros
- Patrimônio, investimentos e assinaturas com indicadores e análises consolidadas
- Configurações persistidas, temas claro/escuro/sistema, densidade e ocultação de valores
- Relatório mensal A4 e exportações `.xlsx` com identidade Nexo, filtros, totais e cabeçalho congelado
- React 19, Vinext, TypeScript, Recharts, ExcelJS, Cloudflare Workers e D1
- Workflow do GitHub Actions que aplica migrations incrementais e publica na `main`

## Requisitos

- Node.js 22.13 ou superior
- Uma conta Cloudflare
- Git e uma conta GitHub

## 1. Executar localmente

```bash
npm ci
npm run dev
```

Abra o endereço exibido no terminal. No ambiente local, o aplicativo usa uma identidade de desenvolvimento. O D1 local é mantido pela ferramenta da Cloudflare.

Para habilitar a análise com IA localmente, copie o exemplo e preencha a chave:

```bash
cp .dev.vars.example .dev.vars
```

Nunca envie `.dev.vars` ao GitHub.

## 2. Repositório e infraestrutura existentes

Não crie recursos paralelos. Este código evolui exclusivamente:

- GitHub: `araujoanderson26-eng/financas-pessoais`
- Branch: `main`
- Worker: `financas-pessoais`
- D1: `financas-pessoais-db`
- URL: `financas-pessoais.araujo-anderson26.workers.dev`

O `database_id` em `wrangler.jsonc` é parte da configuração versionada e não deve ser substituído.

## 3. Validar e publicar

Autentique a CLI:

```bash
npx wrangler login
```

Antes de publicar, valide o pacote e aplique somente migrations incrementais:

```bash
npm run lint
npm test
npm run cf:dry-run
npm run cf:migrate
npx wrangler deploy
```

O terminal mostrará a URL `*.workers.dev` ao concluir.

## 4. Proteger os dados com Cloudflare Access

Este aplicativo contém dados financeiros pessoais. **Configure o Cloudflare Access antes de cadastrar dados reais.**

No painel Cloudflare Zero Trust:

1. Abra **Access > Applications** e crie uma aplicação **Self-hosted**.
2. Informe o domínio completo do Worker publicado.
3. Crie uma política **Allow** limitada ao seu e-mail.
4. Use seu provedor de identidade ou o método **One-time PIN**.
5. Teste em uma janela anônima: o painel só deve abrir depois do login.

Se você conectar um domínio próprio, proteja esse domínio também. Mantenha o endereço `workers.dev` coberto pelo Access ou desative-o, para que não exista uma rota pública alternativa.

O backend usa o e-mail autenticado pelo Access como proprietário dos registros. Requisições sem identidade recebem `401`.

## 5. Análise com IA (opcional)

Sem uma chave da OpenAI, a análise mensal continua funcionando no modo local, baseado em regras. Para habilitar respostas de IA no Worker:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put OPENAI_MODEL
```

No segundo comando, você pode informar `gpt-5.6` ou outro modelo compatível disponível na sua conta.

## 6. Publicação automática pelo GitHub Actions

O workflow `.github/workflows/deploy-cloudflare.yml` publica todo push na branch `main`. No repositório, abra **Settings > Secrets and variables > Actions** e crie:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

O token deve ter, no mínimo, permissões para editar Workers Scripts e D1. O banco precisa ter sido criado e o `database_id` precisa estar versionado no `wrangler.jsonc` antes de executar o workflow.

Depois disso, um novo push em `main` executará migrações e publicará o Worker. Também é possível iniciar manualmente em **Actions > Publicar na Cloudflare > Run workflow**.

## Comandos úteis

```bash
npm run cf:dry-run       # gera e valida o pacote sem publicar
npm run cf:migrate       # aplica migrações no D1 remoto
npm run cf:deploy        # gera e publica manualmente
npx wrangler tail        # acompanha logs do Worker
npx wrangler versions list
```

## Estrutura principal

```text
app/                     interface e rotas da aplicação
components/              módulos de produto e componentes compartilhados
hooks/                   sincronização e preferências da interface
lib/finance/             cálculos e modelos financeiros
lib/excel/               exportações profissionais em Excel
lib/formatters/          moeda, datas, meses e percentuais
worker/index.ts          APIs, autenticação e entrada do Worker
db/                      schema e acesso ao D1
drizzle/                 migrações versionadas do banco
.github/workflows/       publicação automática
wrangler.jsonc           configuração da Cloudflare
```

## Backup e recuperação

- A interface oferece exportação dos dados do usuário.
- O backup JSON inclui configurações, snapshots e histórico de exportações.
- O Excel completo reúne 11 abas e não altera o banco.
- Antes de alterações importantes, exporte um backup pela aplicação.
- Para restaurar uma versão do código, use o histórico do Git e publique novamente.
- Para acompanhar publicações e versões do Worker, use `npx wrangler versions list`.

## Observações de segurança

- Não coloque chaves, tokens ou arquivos `.dev.vars` no repositório.
- Restrinja o acesso ao GitHub e à conta Cloudflare.
- Ative autenticação de dois fatores nas duas contas.
- Não remova a proteção de identidade de `worker/index.ts`.
