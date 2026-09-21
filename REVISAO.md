# Revisão técnica — Nexo Finanças Pessoais

Data: **08/09/2026**. Escopo exclusivo deste módulo. Correções no checkout, sem commit, push, deploy, migrations remotas ou integração definitiva.

## Situação encontrada

Aplicação financeira sobre React/Vinext/Workers/D1, com 11 áreas, exportações Excel/JSON, relatórios e consultor IA. Foram inspecionados estrutura, componentes, hooks, cálculos, APIs, schema/migrations, autenticação, configurações, dependências, assets, workflow e testes. A revisão combinou inspeção, testes isolados, browser local e consultas de leitura ao D1 remoto.

Riscos principais: identidade por cabeçalho sem verificação criptográfica; validação incompleta; gravações compostas frágeis; referências desprotegidas; sincronização com feedback enganoso; tabelas ocultas em telas pequenas. Comandos npm dependentes de Bash falhavam no Windows deste ambiente. Não foram encontradas credenciais secretas versionadas nos arquivos inspecionados.

## Correções e melhorias

| Problema | Resultado |
| --- | --- |
| Identidade não verificada | JWT Access com assinatura, emissor, audiência e claims; configuração ausente bloqueia APIs |
| Fallback local | Flag explícita aceita apenas em loopback; injetada somente no desenvolvimento |
| Permissões acopladas | Principal e escopos checados no Worker, owner derivado da identidade |
| Entradas inválidas | Validação de tipos, datas reais, enums, valores, IDs, limites e origem/corpo JSON |
| Parcelamento | Total preservado em centavos, dias válidos no fim do mês e limite de 120 parcelas |
| Descrições parceladas longas | Descrições geradas continuam editáveis/importáveis |
| Auditoria separada | Eventos de criação/edição/arquivamento dentro da mesma transação por triggers |
| Notas/orçamentos frágeis | Atualização/inserção condicional atômica, preservando ID e dados em falhas |
| Categorias e concorrência | Referências/cascata no D1, macro canônica; mesclas conflitantes falham sem perda |
| Exclusão de conta/categoria em uso | Proteção no banco e resposta de conflito |
| Inicialização/snapshots | Configuração idempotente e seleção dos snapshots mais recentes |
| Sincronização | Bloqueio síncrono de envios simultâneos, controle de respostas fora de ordem e timeout |
| Falso sucesso | Erros visíveis; sessão expirada limpa dados; gravação confirmada com refresh falho orienta não repetir |
| Preferências concorrentes | Patches por campo no cliente e UPSERT apenas das preferências enviadas |
| Busca/navegação | Abertura do item escolhido, seleções repetidas, hash e histórico do navegador |
| Mobile | Tabelas de patrimônio/investimentos e demais áreas voltam a aparecer com rolagem |
| Formulários/modais | Formulário preservado em erro, referência estável após await, foco/Tab/Escape/restauração |
| Cálculos | Projeção sem multiplicar futuros, variação percentual correta, composição proporcional e vencimentos reais |
| Arquivos | Filtros sobre linhas reais, subtotais consistentes, identidade respeitada, CSV seguro e erros explícitos |
| Tooling | Build/lint/dev multiplataforma, caches excluídos do typecheck/lint, verificações antes de deploy |

## Refatorações e arquivos importantes

- `worker/index.ts` passou a concentrar roteamento/autorização; `identity.ts`, `http.ts`, `validation.ts` e `finance.ts` separam confiança, transporte, validação e persistência.
- `drizzle/0005_module_integrity.sql`, `0006_category_cascade.sql`, `db/schema.ts` e `drizzle/meta/` alinham índices, integridade e histórico de geração.
- `hooks/useFinanceData.ts`, `useModuleNavigation.ts`, `useDialogFocus.ts` concentram sincronização, navegação e acessibilidade.
- `app/page.tsx`, `globals.css`, `error.tsx` e componentes corrigem feedback, responsividade e fluxos.
- `lib/finance/analytics.ts`, `csv.ts`, `lib/formatters/index.ts`, `lib/excel/index.ts` corrigem cálculos e exportações.
- `scripts/build.mjs`, `validate-artifact.mjs`, `db-audit.sql`, configurações e workflow tornam a validação reproduzível.
- `tests/finance.test.mjs`, `identity.test.mjs`, `exports.test.mjs` e `helpers.mjs` acrescentam regressões de domínio, JWT, atomicidade e Excel real.
- `app/chatgpt-auth.ts` foi removido após confirmar ausência de consumidores; utilizava autenticação legada não verificada.

Não houve reescrita geral, troca de banco/runtime, arquitetura distribuída ou extração prematura para outros módulos.

## Banco e persistência

O D1 original foi mantido. Migrations antigas não foram reescritas. `0005` e `0006` não removem tabelas/dados nem recalculam legados; acrescentam índices e triggers. Duplicidades antigas, se houver, permanecem para conciliação explícita. A suíte aplica a sequência inteira em SQLite temporário e testa interfaces equivalentes às do D1. Migrations e fluxos também foram executados no D1 local via Wrangler.

A consulta remota mostrou **0005 e 0006 pendentes**, sem aplicação nesta revisão. Sete consultas de integridade retornaram zero ocorrências: duplicidades de categorias/orçamentos/notas, categorias órfãs nas movimentações, macros inconsistentes, valores/tipos/parcelamentos inválidos nos critérios consultados e contas órfãs nas movimentações. `rows_written` foi zero. Esses resultados se limitam aos critérios e momento consultados; não comprovam todas as regras possíveis sobre legados.

Dados de QA ficaram exclusivamente no banco local e foram removidos por ID e descrição exatos após os testes; a preferência de tema foi restaurada. Nenhum dado de produção foi alterado. Antes da liberação, repetir auditoria e obter backup administrativo, pois a produção pode ter mudado desde a leitura.

## Segurança e dependências restantes

Atualizados React/React DOM/RSC, Next/eslint-config-next, Vite e transitivas compatíveis; adicionado jose para JWT. `npm audit` caiu de **20 ocorrências (12 altas, 7 moderadas, 1 baixa)** para **8 (2 altas, 6 moderadas)**.

| Cadeia | Risco e decisão |
| --- | --- |
| `image-size` / `vinext` — altas | Parser de imagens transitivo sem correção compatível disponível na auditoria. Uso encontrado no processamento de imports locais durante build; sem upload de imagens na aplicação e sem parser encontrado no bundle do servidor. Revisar imagens não confiáveis e acompanhar upstream. Sugestão automática muda Vinext para beta incompatível com o escopo. |
| `esbuild`, `@esbuild-kit/*`, `drizzle-kit` — moderadas | Cadeia de desenvolvimento/schema. Manter servidor local em loopback; evitada alteração forçada de Drizzle. |
| `uuid` / `exceljs` — moderadas | Transitiva da exportação, ainda sem resolução nas atualizações compatíveis. Evitada troca forçada da linha da biblioteca; geração real do Excel coberta por regressão. |

Não foi usado `npm audit fix --force`, nem ocultado o relatório. A dívida de dependências exige acompanhamento e atualização separada validada. O build também emite aviso de chunk grande do ExcelJS (carregado sob demanda) e de classificação de rota pelo Vinext, sem impedir build/dry-run.

Erros internos não expõem SQL, tokens ou dados pessoais. APIs financeiras usam `no-store`. Escritas JSON verificam origem e tamanho; IA mantém seus limites e rate limiter. Ocultação visual não equivale a anonimização nem controle de acesso.

## Funcionalidades reais e preservações

CRUD disponível, notas, configurações, arquivos, filtros e cálculos usam dados persistidos. Não há dados financeiros fictícios injetados. Categorias iniciais são configuração. O consultor possui integração real, mas a revisão usou provedores simulados, sem chamadas pagas; erros/configuração ausente são mostrados.

Foram preservados identidade Nexo, layout, D1, separação por proprietário, arquivamento de movimentações, edição individual de parcelas, BRL/pt-BR e fluxos existentes. Não se criou login paralelo, integração bancária ou vínculo com CRM/Agenda/Investimentos externos.

Continuam parciais/intencionais: posições manuais; contas/metas sem edição; assinaturas sem lançamentos automáticos; importação apenas por API; ausência de restore integral; projeções/reserva por heurística; conversa IA em memória; auditoria de movimentações sem trilha administrativa completa.

## Validação e limites da evidência

A suíte cobre JWT válido/inválido/expirado, isolamento, escopos, corpo inválido, CRUD, centavos/datas, referências, concorrência de categorias, rollback, notas/orçamentos/configurações, importação, JSON com arquivados, cálculos, CSV, leitura de workbook Excel real, notificações, provedores IA simulados e renderização do Worker empacotado.

| Verificação final | Resultado |
| --- | --- |
| `npm run cf:types` | Tipos dos bindings gerados |
| `npm run typecheck` | Aprovado, sem erros |
| `npm run lint` | Aprovado, sem erros |
| `npm test` | Build aprovado; **58 testes passaram**, zero falhas/skips |
| `npx wrangler deploy --dry-run` | Aprovado; Worker com 986,83 KiB comprimidos, sem publicação |
| `git diff --check` | Sem erros de whitespace |
| `npm audit` | 8 ocorrências transitivas pendentes, detalhadas acima |

Avisos não bloqueantes: chunk ExcelJS, classificação estática da rota Vinext, tempos de plugins e import de configuração sem extensão para um futuro modo nativo do Vite. Os logs de erro emitidos durante testes de falhas são esperados e verificam o tratamento de erro; não representam testes reprovados.

No browser local foram usados 1440×900, 768×1024 e 390×844. Foram verificados cadastro parcelado e reload, patrimônio/investimentos visíveis no celular, nota mensal persistida, navegação e configurações. Não houve campanha completa de leitor de tela, todos os navegadores ou carga de produção. PDF usa impressão do navegador, sem gerador no servidor. Login Access e IA reais permanecem para validação operacional.

## Próximas atenções

1. Confirmar política/domínios Access, audiência e JWT real antes do deploy; ausência de configuração bloqueia APIs.
2. Aplicar `0005`/`0006` junto desta versão após backup; não publicar somente o código contra schema antigo. Suspender gravações durante essa transição: a versão antiga ainda registra eventos pela API e pode duplicar auditoria se continuar gravando após a instalação dos novos triggers.
3. Acompanhar dependências vulneráveis e disponibilidade dos modelos IA na conta real.
4. Definir identidade estável, mapa de e-mails legados, tenant, perfis e auditoria do Portal.
5. Adaptar URLs `/api/*`, hash, shell e CSS global à montagem central.
6. Para maior volume, paginação/agregações no servidor e política de retenção.
7. Para uso colaborativo, idempotência de reenvios e versionamento de registros; edição do mesmo campo atualmente segue a última gravação confirmada.

O módulo está preparado para uma integração planejada; não foi declarado integrado nem validado em produção.
