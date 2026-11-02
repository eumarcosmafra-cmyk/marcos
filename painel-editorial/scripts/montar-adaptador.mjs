#!/usr/bin/env node
// Monta o JSON do workflow adaptador a partir dos arquivos em n8n/adaptador/.
// Uso: node scripts/montar-adaptador.mjs [--credencial-id=XXXX] [--saida=arquivo.json]
// Sem --credencial-id, mantém o marcador __CREDENCIAL_ID__ (versão versionada no repositório).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "n8n", "adaptador");
const arg = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");

const ler = (f) => readFileSync(join(dir, f), "utf8");
const sha = ler("_sha256.js");
export const CODIGO = {
  validar: ler("validar.js"),
  leitura: ler("leitura.js").replace("// __SHA256__", sha),
  encaminhar: "// Nó Code \"Encaminhar pedido à fila\": envia só o pedido validado ao subworkflow.\nreturn [{ json: $input.first().json.pedido }];\n",
  respostaFila: ler("resposta-fila.js"),
  erroFila: ler("erro-fila.js"),
};

export const IDS = {
  workflowFila: "8zHUZGYSA0nPhMWI",
  tabelaFila: "Z8Fekq9qMO3DRWNA",
  webhookId: "5b0f7e8e-3c1d-4f6a-9d2e-7a9c1e4b2f10",
  path: "painel-editorial/v1",
  credencialNome: "Painel editorial - token do adaptador",
};

export function montarWorkflow(credencialId = "__CREDENCIAL_ID__") {
  const ifNode = (id, name, position, valor) => ({
    id,
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.4,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 4 },
        conditions: [{ id: `${id}-c`, leftValue: "={{ $json.rota }}", rightValue: valor, operator: { type: "string", operation: "equals" } }],
        combinator: "and",
      },
      options: {},
    },
  });
  const code = (id, name, position, jsCode, extra = {}) => ({
    id,
    name,
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position,
    parameters: { mode: "runOnceForAllItems", language: "javaScript", jsCode },
    ...extra,
  });

  const nodes = [
    {
      id: "a1000000-0000-4000-8000-000000000001",
      name: "Receber pedido do painel",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 200],
      webhookId: IDS.webhookId,
      parameters: { httpMethod: "POST", path: IDS.path, authentication: "headerAuth", responseMode: "responseNode", options: {} },
      credentials: { httpHeaderAuth: { id: credencialId, name: IDS.credencialNome } },
    },
    code("a1000000-0000-4000-8000-000000000002", "Validar pedido do painel", [220, 200], CODIGO.validar),
    ifNode("a1000000-0000-4000-8000-000000000003", "Pedido recusado?", [440, 200], "recusa"),
    ifNode("a1000000-0000-4000-8000-000000000004", "Leitura restrita?", [660, 300], "leitura"),
    code("a1000000-0000-4000-8000-000000000005", "Encaminhar pedido à fila", [880, 400], CODIGO.encaminhar),
    {
      id: "a1000000-0000-4000-8000-000000000006",
      name: "Executar operação da fila",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.4,
      position: [1100, 400],
      onError: "continueErrorOutput",
      parameters: {
        source: "database",
        workflowId: { __rl: true, value: IDS.workflowFila, mode: "id" },
        mode: "once",
        options: { waitForSubWorkflow: true },
      },
    },
    code("a1000000-0000-4000-8000-000000000007", "Formatar resposta da fila", [1320, 340], CODIGO.respostaFila),
    code("a1000000-0000-4000-8000-000000000008", "Formatar falha da fila", [1320, 500], CODIGO.erroFila),
    {
      id: "a1000000-0000-4000-8000-000000000009",
      name: "Ler fila do escopo",
      type: "n8n-nodes-base.dataTable",
      typeVersion: 1.1,
      position: [880, 200],
      alwaysOutputData: true,
      parameters: {
        resource: "row",
        operation: "get",
        dataTableId: { __rl: true, value: IDS.tabelaFila, mode: "id", cachedResultName: "SEO V2 - Fila editorial Markdown" },
        options: {},
        matchType: "allConditions",
        filters: {
          conditions: [
            { keyName: "cliente_id", condition: "eq", keyValue: '={{ $("Validar pedido do painel").first().json.pedido.cliente_id }}' },
            { keyName: "ambiente", condition: "eq", keyValue: '={{ $("Validar pedido do painel").first().json.pedido.ambiente }}' },
          ],
        },
        returnAll: true,
      },
    },
    code("a1000000-0000-4000-8000-00000000000a", "Leitura restrita da fila", [1100, 200], CODIGO.leitura),
    {
      id: "a1000000-0000-4000-8000-00000000000b",
      name: "Responder ao painel",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [1560, 200],
      parameters: { respondWith: "json", responseBody: "={{ $json.resposta }}", options: { responseCode: "={{ $json.http_status }}" } },
    },
  ];

  const to = (node, index = 0) => ({ node, type: "main", index });
  const connections = {
    "Receber pedido do painel": { main: [[to("Validar pedido do painel")]] },
    "Validar pedido do painel": { main: [[to("Pedido recusado?")]] },
    "Pedido recusado?": { main: [[to("Responder ao painel")], [to("Leitura restrita?")]] },
    "Leitura restrita?": { main: [[to("Ler fila do escopo")], [to("Encaminhar pedido à fila")]] },
    "Ler fila do escopo": { main: [[to("Leitura restrita da fila")]] },
    "Leitura restrita da fila": { main: [[to("Responder ao painel")]] },
    "Encaminhar pedido à fila": { main: [[to("Executar operação da fila")]] },
    "Executar operação da fila": { main: [[to("Formatar resposta da fila")], [to("Formatar falha da fila")]] },
    "Formatar resposta da fila": { main: [[to("Responder ao painel")]] },
    "Formatar falha da fila": { main: [[to("Responder ao painel")]] },
  };

  return {
    name: "Painel editorial - adaptador autenticado (v1)",
    description: "Ponte autenticada entre o painel editorial e a fila V2 (8zHUZGYSA0nPhMWI). Operações: consultar, salvar_edicao, decidir, ler_versao, ler_resumos.",
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: false,
      saveExecutionProgress: false,
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "all",
      executionTimeout: 120,
      timezone: "America/Sao_Paulo",
      callerPolicy: "none",
    },
    pinData: {},
    tags: [],
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const wf = montarWorkflow(arg("credencial-id"));
  const id = arg("workflow-id");
  if (id) wf.id = id;
  const saida = arg("saida") ?? join(raiz, "n8n", "adaptador-painel.workflow.json");
  writeFileSync(saida, JSON.stringify(wf, null, 2) + "\n");
  console.log(`Workflow gravado em ${saida} (${wf.nodes.length} nós).`);
}
