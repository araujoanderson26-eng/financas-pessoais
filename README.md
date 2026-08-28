# Finanças Pessoais

Sistema web responsivo para gestão financeira pessoal, pronto para versionamento no GitHub e publicação em Cloudflare Workers com banco Cloudflare D1.

## O que está incluído

- Dashboard com patrimônio, fluxo de caixa, taxa de poupança e gráficos
- Contas PF/PJ, cartões, lançamentos, categorias e parcelas
- Investimentos, assinaturas, orçamento, metas e patrimônio
- Relatório mensal para impressão/PDF e análise automática
- Filtros, histórico de alterações, exportação e backup
- React 19, Vinext, TypeScript, Recharts, Cloudflare Workers e D1
- Workflow do GitHub Actions para publicação automática

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

## 2. Criar o repositório no GitHub

Crie um repositório vazio no GitHub e execute, dentro desta pasta:

```bash
git init
git add .
git commit -m "feat: versão inicial do Finanças Pessoais"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/financas-pessoais.git
git push -u origin main
```

## 3. Preparar a Cloudflare

Autentique a CLI:

```bash
npx wrangler login
```

Crie o banco e grave automaticamente o `database_id` em `wrangler.jsonc`:

```bash
npx wrangler d1 create financas-pessoais-db --binding DB --update-config
```

Confirme que o arquivo `wrangler.jsonc` passou a conter um `database_id`, então versione essa alteração:

```bash
git add wrangler.jsonc
git commit -m "chore: vincula banco D1"
git push
```

Aplique as migrações e publique:

```bash
npm run build:cloudflare
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
worker/index.ts          APIs, autenticação e entrada do Worker
db/                      schema e acesso ao D1
drizzle/                 migrações versionadas do banco
.github/workflows/       publicação automática
wrangler.jsonc           configuração da Cloudflare
```

## Backup e recuperação

- A interface oferece exportação dos dados do usuário.
- Antes de alterações importantes, exporte um backup pela aplicação.
- Para restaurar uma versão do código, use o histórico do Git e publique novamente.
- Para acompanhar publicações e versões do Worker, use `npx wrangler versions list`.

## Observações de segurança

- Não coloque chaves, tokens ou arquivos `.dev.vars` no repositório.
- Restrinja o acesso ao GitHub e à conta Cloudflare.
- Ative autenticação de dois fatores nas duas contas.
- Não remova a proteção de identidade de `worker/index.ts`.

