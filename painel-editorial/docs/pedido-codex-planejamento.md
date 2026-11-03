# Pedido ao Codex — planejamento e pautas utilizáveis pelo painel

Contexto: o painel editorial (`painel-editorial/`) já lê e altera a fila V2 (`8zHUZGYSA0nPhMWI`) e dispara o produtor (`Kk56hrmdN3ljNUh0`) por um adaptador autenticado. Para mostrar o planejamento e colocar pautas na fila, faltam dados e uma operação que hoje não existem. Inventário de 03/11/2026, só leitura:

- O Analista (`F0bD46wVPmZWNr3q`) e o Planejador (`5Nv1dKBiFAA7Tn3a`) são pilotos manuais e não têm versão publicada. O arquivo de entrada do Planejador (`/home/node/.n8n-files/planejador-v2-848bd4bc-…/input.json`) não existe mais.
- **O plano com as pautas não fica gravado em lugar nenhum.** Na `I0kHnbGg35Y9RA5Y` há só a pesquisa do Planejador (182 keywords, 8 SERPs).
- Coleções de fontes (F1…F5 com `inicio`, `fim` e `limites`) só existem dentro do pacote do P004, na fila.
- O pacote é montado pela cadeia manual `EFwvYRokClpQPHcH`. Nenhum workflow ativo enfileira pautas.
- O contrato aceito pela fila é de piloto: `versao: cadeia_editorial_v2_teste`, `chain_control.ambiente: teste`, `research_input.pauta_producao_aprovada: false`.

## O que o painel precisa (nesta ordem)

### 1. Plano gravado (sem mudar o Planejador além da gravação)
Na `I0kHnbGg35Y9RA5Y`, uma linha por plano:
- `tipo`: `plano`
- `cache_key`: `plano:<cliente_id>:<plano_id>`
- `payload_json`, com `payload_sha256 = sha256(payload_json)`:

```json
{
  "plano_id": "…",
  "cliente_id": "altovaletopteam_com_br",
  "analise_sha256": "…",
  "plano_sha256": "…",
  "criado_em": "ISO-8601",
  "pautas": [
    { "id": "P004", "keyword_id": "K178", "keyword": "wai kru significado", "titulo": "…", "acao": "criar",
      "url_existente": null, "tema": "…", "intencao": "informacional", "prioridade": "baixa",
      "justificativa": "…", "diferenca_acervo": "…", "serp_id": "S07", "metricas": {}, "status": "candidata_para_revisao" }
  ]
}
```

Cada pauta deve gerar o mesmo `pauta_sha256 = sha256(JSON.stringify(pauta))` que a cadeia usa hoje em `research_input.pauta_sha256`.

### 2. Fontes curadas por pauta
Na mesma tabela, uma linha por coleção:
- `tipo`: `fontes_pauta`
- `cache_key`: `fontes:<cliente_id>:<pauta_id>:<pauta_sha256>`
- `payload_json` no formato de `research_input.fontes` do P004: `assunto`, `keyword`, `pauta_sha256`, `documentos[]` com `id` F1…F5, `url`, `titulo`, `entidade`, `versao`, `inicio`, `fim`, `localizador` e `limites`.
- Dizer explicitamente quem cura essas fontes (pessoa ou workflow) e se isso tem custo de API.

### 3. Operação de montar e enfileirar o pacote (sem IA)
Um subworkflow publicado, com `executeWorkflowTrigger` (passthrough) e `callerPolicy: workflowsFromSameOwner`, no projeto `1OqXGCWWyJ96f5xm`:
- **Entrada:** `cliente_id`, `ambiente`, `plano_cache_key`, `pauta_id`, `ator_id`, `op_id`, `confirmo_pauta`.
- **O que faz:** monta o pacote a partir do plano (1), das fontes (2) e do acervo do cliente (`client`/`acervo`), sem chamar modelo, e chama o `8zHUZGYSA0nPhMWI` com `enfileirar`.
- **Recibo:** o mesmo da fila, mais `motivo` quando recusar. Exemplos: `pauta_sem_fontes_curadas`, `plano_alterado`.
- `saveDataErrorExecution: all`.

### 4. Decisão de contrato (Marcos + Codex)
Hoje a fila só aceita pacotes de piloto (`pauta_producao_aprovada: false`). Para pautas de produção, definir:
- a nova versão do contrato, por exemplo `cadeia_editorial_v2`;
- os marcadores de produção;
- o que muda na validação (`validateChain`).

Até lá, o painel só enfileira em `ambiente: teste`.

## O que o painel faz quando 1–3 existirem
- **Leitura sem trava** dos planos e das coleções de fontes (mesma técnica do `ler_trabalho`).
- **Tela de Planejamento:** pautas do plano com status: *sem fontes curadas*, *pronta para enfileirar*, *na fila* (estado e versão) e *aguardando aprovação*.
- **"Enfileirar pauta"** (chama a operação 3) e **"Aprovar pauta"** (`aprovar_pauta`, estado `aguardando_pauta`). Nos dois, o editor vem da sessão e há confirmação explícita.

## Fora deste pedido
- Corrigir a qualidade do RAG ("agentes delirando"): é frente separada e deveria vir antes de produzir pautas em volume.
- Revisão do professor e autorização de publicação: operações novas na fila, pedido separado. A tabela V1 "SEO - Trabalhos editoriais" (`Nv3vb6PCYgaWlDqY`) tem 4 trabalhos em `aguardando_professor`; vale reaproveitar esse desenho.
