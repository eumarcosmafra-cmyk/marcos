# Integração — MAFRA LABS Editorial

## Estado atual (02/11/2026)

**Conectado:** o painel real (`/fila`) lê e altera a **fila editorial V2 do n8n** (Data Table `Z8Fekq9qMO3DRWNA`, subworkflow `8zHUZGYSA0nPhMWI`) por meio de:

1. backend do próprio painel (rotas Next.js, sessão assinada, entradas montadas a partir da sessão);
2. workflow adaptador no n8n (`n8n/adaptador-painel.workflow.json`): Webhook com Header Auth na rede Docker interna, validação de operação/campos/escopo e Execute Sub-workflow fixo.

Operações: `consultar`, `salvar_edicao`, `decidir`, `preparar_correcao`; `retomar_producao` (produtor Kk56hrmdN3ljNUh0, sem aguardar, com autorização explícita de cobrança); leituras restritas `ler_trabalho` (recibo de `consultar` sem trava), `ler_resumos` (títulos/datas) e `ler_versao` (texto de versões anteriores). Implantação e operação: [DEPLOY.md](./DEPLOY.md).

**Ainda não conectado** (as seções abaixo continuam válidas para estas partes): planejamento de pautas e aprovação de pauta, enfileiramento, recibo de trechos do RAG (aba Fontes do protótipo), registro da revisão do professor (não existe operação na fila), autorização de publicação e publicação no Astro, domínio com HTTPS.

---

O restante deste documento descreve a evolução prevista a partir do protótipo demonstrativo (`/p`), que guarda dados no `localStorage`.

## 1. Como o código está dividido

| Camada | Onde | Papel |
|---|---|---|
| Contratos | `src/domain/types.ts` | Projeto, pauta, briefing (snapshot), versão do artigo, comentário, decisão humana, pendência de qualidade, execução de workflow, fonte da biblioteca, trecho recuperado, inventário, atividade. |
| Regras | `src/domain/rules.ts` | Deriva o estado do artigo **a partir das decisões sobre a versão atual**, os requisitos de aprovação, contadores e fila. Funções puras. |
| Comandos | `src/domain/commands.ts` | Toda alteração é um `EditorialCommand` validado por `applyCommand()`. |
| Mapeamento de workflows | `src/domain/workflow-mapping.ts` | Status dos workflows → fila/pendências; adaptador tolerante da saída de redação. |
| Acesso a dados | `src/data/repository.ts` | Interface `EditorialRepository` — a única dependência das telas. |
| Implementação local | `src/data/local-repository.ts` | Aplica os comandos no navegador e grava uma chave por projeto. |
| Telas | `src/components/**` | Não conhecem o armazenamento. |

Os nomes dos contratos **não presumem tabelas existentes no Supabase**. O adaptador é quem traduz o esquema real para esses tipos.

## 2. Substituindo a implementação local

1. Criar `ApiEditorialRepository implements EditorialRepository` (`src/data/api-repository.ts`):
   - `listProjects()` → `GET /api/projetos` (somente projetos do usuário autenticado).
   - `getWorkspace(id)` → `GET /api/projetos/:id` (ou endpoints por recurso, se o volume crescer).
   - `execute(id, command)` → `POST /api/projetos/:id/comandos` com o `EditorialCommand` serializado.
   - `subscribe()` → Supabase Realtime ou polling.
   - `getDemoSettings/saveDemoSettings/resetDemo` deixam de existir em produção: a identidade vem da sessão.
2. Criar as rotas de servidor no próprio Next.js do painel (`src/app/api/...`). Em cada rota:
   - autenticar a sessão;
   - autorizar o acesso **ao projeto** (membro do projeto, com papel: editor, especialista, gestão);
   - carregar o agregado do banco, executar **o mesmo `applyCommand()`** e persistir em transação;
   - registrar `actor` a partir da sessão — nunca a partir do corpo da requisição.
3. Trocar a instância em `src/state/editorial.tsx` (`new LocalEditorialRepository(...)`) pela implementação de API, por variável de ambiente pública que contenha só o modo (`NEXT_PUBLIC_EDITORIAL_MODE=api`), nunca credenciais.

O navegador não é fonte de verdade: as validações de `rules.ts`/`commands.ts` precisam rodar no servidor.

## 3. Regras que a persistência real precisa garantir

- **Versões imutáveis.** Salvar cria uma nova linha; nunca atualiza o texto de uma versão existente. Conflito de edição: rejeitar quando `baseVersionId` ≠ versão atual.
- **Decisões append-only**, sempre com `article_id + version_id` (ou `pauta_id + pauta_revision`). Nada de “status” editável à mão.
- **Estado editorial derivado.** Se persistir um campo de etapa para consulta, recalculá-lo a partir das decisões (trigger ou função), nunca aceitá-lo do cliente.
- Nova versão não herda aprovações; pedido de ajuste anula a aprovação da mesma versão.
- **Saída automática, revisão humana e versão aprovada separadas.** A saída do workflow vira uma versão com `origin.kind = "workflow"` e `runId`; decisões humanas ficam em outra tabela; “aprovada” é a versão com decisão `aprovacao_final` vigente.
- **Status original do workflow preservado** no registro técnico (`workflow_runs.original_statuses`), sem virar decisão humana.
- Parecer de IA é dado auxiliar (`aiReview`), sem permissão de gravar decisões.
- “Publicado” só com `PublicationRecord` (URL + data + quem confirmou + versão).

Sugestão de tabelas (a validar com o esquema real): `projects`, `project_members`, `pautas`, `pauta_revisions`, `articles`, `article_versions`, `decisions`, `comments`, `quality_flags`, `workflow_runs`, `retrieved_chunks`, `library_sources`, `inventory_items`, `activity_events`. Todas com `project_id` e políticas RLS por membro do projeto.

## 4. Entrada dos workflows (n8n → painel)

Saídas atuais de redação podem conter: `cliente_id`, `palavra_chave`, `briefing_markdown`, `artigo_markdown`, `palavras`, `avisos`, `legibilidade`, `citacoes`, `fontes_dominio`, `fontes_metodo`, `rag_hibrido`, `controle`.

`adaptRedacaoOutput()` já converte esses campos e lista os ausentes (`missingFields`) para estados vazios:

| Campo | Destino no painel |
|---|---|
| `cliente_id` | resolver para `Project.id` no servidor (nunca confiar no valor sem checar o vínculo) |
| `palavra_chave`, `briefing_markdown` | `BriefingSnapshot` da versão |
| `artigo_markdown` | nova `ArticleVersion` com `origin.kind = "workflow"` |
| `palavras`, `avisos`, `legibilidade`, `controle` | `WorkflowRun.technical` |
| `fontes_dominio`, `fontes_metodo`, `rag_hibrido` | `RetrievedChunk` (somente com categoria declarada; sem categoria, não classificar por suposição) |
| `citacoes` | lista de citações declaradas (exibir separada dos trechos recebidos) |

Status mapeados (`mapWorkflowStatuses`):

- `aguardando_revisao_humana` → fila de revisão editorial;
- `revisao_obrigatoria_legibilidade` → `QualityFlag` de legibilidade com os motivos recebidos;
- `revisao_obrigatoria_fontes` → `QualityFlag` de fontes com os motivos recebidos;
- os dois podem coexistir; status desconhecidos são preservados em `unknownStatuses`.

Endpoint sugerido: `POST /api/integracoes/n8n/redacao`, autenticado por assinatura HMAC do corpo (segredo só no servidor e no n8n), idempotente pelo id da execução.

**Recibo de recuperação.** `WorkflowRun.hasRetrievalReceipt` só pode ser `true` quando a execução informar os trechos efetivamente entregues ao agente (texto, chunk id, origem, momento). Sem recibo, a aba Fontes mostra “Uso não comprovado nesta execução”. Similaridade só é exibida se vier no dado.

## 5. Saída para os agentes (painel → n8n)

“Solicitar ajustes”, “Pedir nova sugestão ao Planejador” e “Solicitar redação” hoje só registram a solicitação localmente. Na integração:

- o servidor chama o webhook do workflow da etapa escolhida (pesquisa, briefing, redação, revisão);
- só exibir “Enviada ao agente” após resposta 2xx **com id de execução**; guardar esse id;
- em falha, manter “Solicitação registrada — envio falhou” com opção de reenviar.

## 6. Publicação (Astro)

- Habilitar “Publicar” apenas para a versão com aprovação final vigente.
- Mecanismo a definir com o repositório do site (PR no repositório Astro, arquivo em `src/content/blog`, ou CMS).
- Marcar “Publicado” somente após confirmação real (URL respondendo + data), gravando `PublicationRecord`.

## 7. Segurança obrigatória antes de produção

- Autenticação real (ex.: Supabase Auth ou NextAuth com Google) e **autorização por projeto** no servidor.
- Isolamento no servidor (RLS) e persistência compartilhada; o `localStorage` deixa de guardar dados de projeto.
- Chaves (`service_role`, tokens do n8n, segredos HMAC, chaves de modelos) **somente** em variáveis de ambiente do servidor. Nunca no bundle, no `localStorage` ou no repositório.
- Revisar cabeçalhos (CSP) quando houver domínios externos.

## 8. Dependências pendentes

- Esquema real das tabelas no Supabase e quais já existem.
- Formato exato de `rag_hibrido`, `citacoes`, `legibilidade` e `controle` (amostras reais de saída).
- Endpoints/webhooks do n8n por agente e política de assinatura.
- Repositório do site Astro e fluxo de publicação desejado.
- Modelo de identidade: quem são editores, especialistas/professores e gestão por cliente.
- Inventário real do site (sitemap). Não foi coletado: o acesso ao domínio estava bloqueado no ambiente em que este painel foi construído.
- Decidir se o painel ganha repositório próprio (hoje está isolado em `painel-editorial/` dentro do repositório `marcos`).
