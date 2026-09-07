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

## 5. Assistente IA com OpenAI

O assistente usa a Responses API da OpenAI. Não existe mais resposta pronta fingindo ser IA: falta de configuração, chave inválida, falta de créditos, limite de uso e falha de conexão aparecem na conversa.

1. Na [plataforma OpenAI](https://platform.openai.com/api-keys), crie uma chave de API e habilite créditos/faturamento. O ChatGPT gratuito ou pago não inclui o consumo da API.
2. No Cloudflare, abra **Workers & Pages > financas-pessoais > Settings > Variables and Secrets**.
3. Adicione `OPENAI_API_KEY` como **Secret**, com sua chave. Nunca coloque a chave no código, no GitHub, em variáveis públicas ou no chat.
4. Se houver um `OPENAI_MODEL` antigo, ajuste para `gpt-5.4-mini`, ou remova para usar esse padrão. Use outro modelo somente se sua conta tiver acesso e ele aceitar a Responses API.
5. Salve e publique a configuração. No site, abra **Consultor IA**, selecione **OpenAI** e envie uma pergunta. O indicador passa de **OpenAI · configurado** para **OpenAI · conectado** somente depois de uma resposta real.

Alternativa pela CLI já autenticada:

```bash
npx wrangler secret put OPENAI_API_KEY
```

A chave é solicitada de forma interativa. A lista de nomes pode ser verificada com `npx wrangler secret list`, sem revelar os valores. Não é necessário mudar o banco para esta integração.

O backend calcula o contexto a partir dos registros D1 do usuário autenticado, sem aceitar totais enviados pelo navegador. Envia totais, categorias e comparação mensal, até 12 meses de evolução, maiores gastos, metas, orçamento, compromissos, carteira e patrimônio. O histórico da conversa é limitado e fica na memória da tela. A OpenAI recebe `store: false`. Os logs contêm códigos de falha, não chaves nem dados financeiros.

Há um limite de seis perguntas por minuto por usuário por localidade Cloudflare; esse limite não substitui um teto de gastos na conta OpenAI. O site inteiro deve continuar protegido pelo Cloudflare Access, inclusive `/api/advisor` e o domínio `workers.dev`.

### Opções com cota gratuita, sem chave da OpenAI

No **Consultor IA**, escolha um modelo no grupo **Cota gratuita compartilhada · sem chave extra**:

- **Llama 3.3 70B**: selecionado inicialmente; parâmetro `provider=cloudflare`.
- **Qwen3 30B**: parâmetro `provider=cloudflare-qwen`.
- **Mistral Small 3.1**: parâmetro `provider=cloudflare-mistral`.

O binding `AI` já está declarado no projeto. Não é necessário criar novas chaves ou contas para esses modelos. Eles são executados no Workers AI, não são o ChatGPT e aparecem identificados pelo nome nas respostas. A opção OpenAI fica separada no grupo **API paga**.

Todos compartilham a mesma cota de 10.000 neurons por dia da conta Cloudflare; trocar de modelo não renova a cota. No plano gratuito, novas solicitações param quando a cota acaba. Em contas pagas, o excedente pode ser cobrado. O consumo varia por modelo e tamanho da conversa. Consulte a [cota e os preços do Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/).

Os dados só são enviados ao provedor escolhido ao enviar uma pergunta. A troca de modelo inicia uma nova conversa. Nenhum erro provoca troca silenciosa de provedor. As respostas usam apenas o texto final, sem exibir os blocos de raciocínio dos modelos.

Para clientes diretos do endpoint que não indicam `?provider=`, `AI_PROVIDER=auto` usa a OpenAI quando há chave e Llama caso contrário; `AI_PROVIDER=cloudflare`, `cloudflare-qwen` ou `cloudflare-mistral` seleciona o modelo correspondente. Sem configuração, o padrão do endpoint continua sendo OpenAI por compatibilidade; a interface sempre envia o modelo escolhido.

Validação da integração (sem consumir API, com banco SQLite temporário e provedores simulados):

```bash
npx wrangler types
npx tsc --noEmit
node --test tests/advisor.test.mjs tests/notifications.test.mjs
npm run cf:dry-run
```

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
