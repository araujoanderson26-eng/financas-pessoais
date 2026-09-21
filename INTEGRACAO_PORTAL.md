# Integração futura — Portal Gestão Comercial

Contrato do módulo **Nexo Finanças Pessoais**, ainda independente. Rotas sugeridas são propostas, não endpoints já publicados. Nenhum outro módulo foi integrado nesta revisão.

## Entrada e rotas

Entrada visual: `app/page.tsx`; layout: `app/layout.tsx`; shell: `components/layout/AppShell.tsx`. Entrada HTTP: `worker/index.ts`. Navegação: `hooks/useModuleNavigation.ts`.

Atualmente a aplicação reside em `/`, com hashes:

| Hash | Área |
| --- | --- |
| `#dashboard` | Visão geral |
| `#movimentos` | Movimentações |
| `#planejamento` | Contas, cartões, metas, orçamentos, parcelas |
| `#patrimonio` | Patrimônio |
| `#categorias` | Categorias |
| `#investimentos` | Carteira deste módulo |
| `#assinaturas` | Assinaturas |
| `#relatorio` | Fechamento mensal |
| `#historico` | Histórico e backup |
| `#consultor` | IA |
| `#configuracoes` | Preferências |

Para uma futura montagem em `/financas`, substituir o adaptador de navegação pelo roteador central e `AppShell` pelo menu/header institucional. Preservar links diretos, reload, voltar/avançar e abertura de resultados de busca.

Não há suporte automático a basePath: fetches atuais usam URLs absolutas `/api/finance`, `/api/backup`, `/api/advisor`. Criar configuração do cliente de API ou gateway ao montar em subdiretório. Imagens usam `/_vinext/image`, administrado pelo runtime.

## APIs e contratos

Identidade é recebida apenas no servidor. Nunca aceitar owner/perfil/permissões do corpo do navegador como autoridade.

| Endpoint atual | Método | Contrato | Escopo |
| --- | --- | --- | --- |
| `/api/finance` | GET | `FinanceData` de `lib/finance/types.ts` | `finance:read` |
| `/api/finance` | POST | JSON com `action` | `finance:write` |
| `/api/backup` | GET | JSON versão 1, todas as tabelas do proprietário | `finance:export` |
| `/api/advisor` | GET | Configuração sem revelar chave | `finance:advisor` |
| `/api/advisor` | POST | `question`, `month` e histórico opcional; `provider` em query | `finance:advisor` |

Ações financeiras:

- `transaction`, `update_transaction`, `delete_transaction` (arquivamento).
- `category`, `update_category`, `delete_category`, `replace_and_delete_category`.
- `investment`, `update_investment`, `delete_investment`.
- `save_account`, `save_budget`, `save_goal`, `save_wealth`, `update_wealth`.
- `delete_planning`: entity restrita a account/budget/goal/wealth.
- `save_subscription`, `archive_subscription`.
- `save_report_note`, `save_settings` (patch), `record_backup`.
- `bulk_import`: 1–500 linhas, categorias/contas existentes, batch atômico. Não restaura backup, não deduplica reenvios nem gera parcelamento a partir dos metadados importados.

Validação em `worker/validation.ts`; leitura em `lib/finance/types.ts`. Escritas retornam item/items/deleted/imported conforme ação. Erros têm `error`; advisor também tem códigos próprios. Status: 400 inválido, 401 identidade, 403 permissão/origem, 404 ausente, 409 conflito, 413 tamanho, 415 formato, 429 limite, 503 configuração/provedor. Respostas privadas, sem cache.

GET financeiro inicializa categorias/preferências e atualiza snapshot diário. Ao implantar consulta estrita, decidir se esses efeitos gerenciados pelo sistema devem passar a inicialização/job separado. Não colocar esse endpoint em cache público. GET backup registra geração, sem comprovar salvamento do arquivo pelo usuário.

## Autenticação e permissões

Substituir o adaptador `worker/identity.ts` quando o contrato do Portal estiver definido:

```ts
type Principal = {
  subject: string;
  owner: string;
  permissions: readonly (
    'finance:read' | 'finance:write' | 'finance:export' | 'finance:advisor'
  )[];
};
```

Hoje o servidor verifica JWT Cloudflare Access via jose/JWKS/RS256, emissor, audiência e expiração. Usuários admitidos pela política externa recebem os quatro escopos sobre os próprios registros. `worker/index.ts` autoriza antes do serviço. Não existe tabela de senhas ou implementação paralela de usuários.

O Portal deverá fornecer identidade confiável e escopos no servidor. Em encaminhamento para outro Worker, usar canal autenticado, como binding privado ou token assinado com audiência específica. Nunca confiar em cabeçalho de e-mail aberto, nem remover autorização porque o botão está oculto.

| Perfil futuro | Decisão pendente |
| --- | --- |
| Administrador | Separar administração da plataforma do direito de ler finanças pessoais |
| Diretoria / Gestor | Definir proprietário/tenant e eventual visão agregada autorizada |
| Operacional | Escrita apenas no escopo de dados permitido |
| Consulta | Leitura; exportação e IA concedidas explicitamente |

Esses perfis não foram implantados. Quem recebe dados no navegador pode copiá-los: `finance:export` protege backup, não é DRM sobre informações lidas. Excel é gerado no cliente; política institucional de exportação exige ajuste específico sem depender apenas de ocultar botões.

## Banco e propriedade

Binding `DB` aponta ao D1 `financas-pessoais-db`; Worker `financas-pessoais`. Preservar IDs em `wrangler.jsonc`; não juntar automaticamente tabelas homônimas de outros módulos.

| Tabela | Conteúdo |
| --- | --- |
| `categories` | Categorias e natureza |
| `transactions` | Entradas/saídas, contas, recorrência, parcelas, arquivamento |
| `investments` | Posições e rentabilidade informadas |
| `accounts` | Contas/cartões com saldos e limites manuais |
| `budgets` | Orçamento por mês/categoria |
| `goals` | Metas e progresso |
| `wealth_items` | Ativos, passivos e dívida |
| `subscriptions` | Serviços periódicos e situação |
| `transaction_events` | Auditoria de movimentações |
| `monthly_notes` | Observações mensais |
| `user_settings` | Preferências |
| `financial_snapshots` | Posição diária observada |
| `backup_events` | Geração de exportações |

Todas usam owner, hoje o e-mail exato verificado pelo Access. Para subject/tenant estável, planejar mapa de propriedade ou migração conciliada. Alteração de e-mail, capitalização e acesso pessoal/corporativo precisam de tratamento explícito, sem reassociar linhas silenciosamente.

Categorias/contas ainda são relacionadas por nome; triggers em `0005`/`0006` protegem referências. Uma migração para IDs estrangeiros exige conciliação e testes. Drizzle representa tabelas/índices; triggers são SQL manual versionado e precisam ser preservados em gerações futuras.

Sequência atual `0000`…`0006`; `0005`/`0006` pendentes em produção nesta revisão. Fazer backup, executar `scripts/db-audit.sql`, aplicar junto do código compatível. Não usar schema push direto em produção.

## Dependências e configuração

React/React DOM/RSC 19, Next compatível com Vinext 0.0.50, Vite 8, Workers/nodejs_compat, D1, Drizzle, Recharts, ExcelJS, Lucide e jose. Unificar versões no Portal antes de deduplicar; duas cópias de React podem quebrar hooks. Manter compatibilidade do runtime Workers.

Bindings/variáveis: `DB`, `ASSETS`, `IMAGES`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`; opcionais `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_PROVIDER`, `AI`, `ADVISOR_RATE_LIMITER`. `LOCAL_DEV_AUTH` é exclusivo de loopback e `FINANCE_REMOTE_AI` do Vite. Veja README para detalhes. Não expor secrets no bundle cliente.

Preservar `.openai/hosting.json` e plugin Sites enquanto usados no empacotamento; deploy é Workers/Wrangler. O workflow publica push em main: definir quem controla o deploy antes de compartilhar CI no Portal.

## Compartilhamento e conflitos potenciais

- `components/shared`, `useDialogFocus` e formatadores são candidatos a componentes/utilitários comuns após comparação com o padrão institucional.
- Shell, busca, menu, header e identidade deverão receber contexto central ou ser substituídos, sem dois menus institucionais.
- `app/globals.css` tem seletores genéricos e atributos em documentElement para tema/densidade/privacidade; também há impressão global. Escopar ao módulo ou consolidar tokens antes da montagem conjunta.
- Decidir quais preferências de `user_settings` permanecem pessoais e quais passam a institucionais.
- A carteira deste módulo não é automaticamente o módulo Investimentos do Portal; conciliar nomes, propriedade e fonte de verdade.
- IA/exportação precisam de políticas de informação, retenção e limites. Conversas não são persistidas; logs técnicos não substituem auditoria de usuários.
- Auditoria central deve definir ator, tenant, ação, alvo, data e correlação para todas as entidades relevantes; atualmente apenas movimentações têm histórico detalhado.

## Sequência recomendada

1. Definir identidade/propriedade, perfis, permissões, rotas e tema.
2. Fazer backup, mapa de dados e homologação das migrations/dependências.
3. Adaptar identidade e cliente de API; testar negação de acesso e isolamento.
4. Montar roteador/shell, resolver CSS/basePath e preservar acessibilidade.
5. Compartilhar apenas componentes compatíveis, mantendo regras financeiras no domínio.
6. Validar CRUD, filtros, arquivos, persistência, concorrência e telas em homologação.
7. Validar Access/IA reais, aplicar migrations, publicar e acompanhar erros com reversão do código disponível.

A integração final depende dessas decisões e validações conjuntas. Esta revisão entrega os pontos de substituição e documentação, sem iniciar outro módulo.
