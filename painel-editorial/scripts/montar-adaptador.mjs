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
  encaminharProdutor: ler("producao-encaminhar.js"),
  respostaProdutor: ler("producao-resposta.js"),
  repassarProdutor: ler("producao-repassar.js"),
  pautas: ler("pautas.js").replace("// __SHA256__", sha),
  encaminharFontes: ler("fontes-encaminhar.js"),
  aceiteFontes: ler("fontes-aceite.js"),
  repassarFontes: ler("fontes-repassar.js"),
  encaminharAprovacao: ler("aprovar-encaminhar.js"),
  encaminharEnfileirador: ler("enfileirar-encaminhar.js"),
};

export const IDS = {
  workflowFila: "8zHUZGYSA0nPhMWI",
  workflowProdutor: "Kk56hrmdN3ljNUh0",
  workflowFontes: "MafraFontesPauta",
  workflowEnfileirador: "1Y2tf9mzggbGIpHZ",
  tabelaContexto: "I0kHnbGg35Y9RA5Y",
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

  const pedidoExpr = (campo) => `={{ $("Validar pedido do painel").first().json.pedido.${campo} }}`;
  const lerTabela = (id, name, position, porChave) => ({
    id,
    name,
    type: "n8n-nodes-base.dataTable",
    typeVersion: 1.1,
    position,
    alwaysOutputData: true,
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, value: IDS.tabelaFila, mode: "id", cachedResultName: "SEO V2 - Fila editorial Markdown" },
      options: {},
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "cliente_id", condition: "eq", keyValue: pedidoExpr("cliente_id") },
          { keyName: "ambiente", condition: "eq", keyValue: pedidoExpr("ambiente") },
          ...(porChave ? [{ keyName: "job_key", condition: "eq", keyValue: pedidoExpr("job_key") }] : []),
        ],
      },
      returnAll: true,
    },
  });

  const lerContexto = (id, name, position, tipo, unicaVez) => ({
    id,
    name,
    type: "n8n-nodes-base.dataTable",
    typeVersion: 1.1,
    position,
    alwaysOutputData: true,
    ...(unicaVez ? { executeOnce: true } : {}),
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, value: IDS.tabelaContexto, mode: "id", cachedResultName: "SEO - Contextos e pesquisa" },
      options: {},
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "cliente_id", condition: "eq", keyValue: pedidoExpr("cliente_id") },
          { keyName: "tipo", condition: "eq", keyValue: tipo },
        ],
      },
      returnAll: true,
    },
  });
  const executar = (id, name, position, workflowId, comSaidaDeErro) => ({
    id,
    name,
    type: "n8n-nodes-base.executeWorkflow",
    typeVersion: 1.4,
    position,
    ...(comSaidaDeErro ? { onError: "continueErrorOutput" } : {}),
    parameters: { source: "database", workflowId: { __rl: true, value: workflowId, mode: "id" }, mode: "once", options: { waitForSubWorkflow: true } },
  });
  const responder = (id, name, position) => ({
    id,
    name,
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position,
    parameters: { respondWith: "json", responseBody: "={{ $json.resposta }}", options: { responseCode: "={{ $json.http_status }}" } },
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
    code("a1000000-0000-4000-8000-000000000005", "Encaminhar pedido à fila", [1320, 400], CODIGO.encaminhar),
    {
      id: "a1000000-0000-4000-8000-000000000006",
      name: "Executar operação da fila",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.4,
      position: [1540, 400],
      onError: "continueErrorOutput",
      parameters: {
        source: "database",
        workflowId: { __rl: true, value: IDS.workflowFila, mode: "id" },
        mode: "once",
        options: { waitForSubWorkflow: true },
      },
    },
    code("a1000000-0000-4000-8000-000000000007", "Formatar resposta da fila", [1760, 340], CODIGO.respostaFila),
    code("a1000000-0000-4000-8000-000000000008", "Formatar falha da fila", [1760, 460], CODIGO.erroFila),
    lerTabela("a1000000-0000-4000-8000-000000000009", "Ler fila do escopo", [1100, 120], false),
    code("a1000000-0000-4000-8000-00000000000a", "Leitura restrita da fila", [1320, 120], CODIGO.leitura),
    ifNode("a1000000-0000-4000-8000-00000000000c", "Leitura de um trabalho?", [880, 400], "leitura_trabalho"),
    lerTabela("a1000000-0000-4000-8000-00000000000d", "Ler trabalho do escopo", [1100, 260], true),
    ifNode("a1000000-0000-4000-8000-00000000000e", "Iniciar produção?", [1100, 520], "producao"),
    code("a1000000-0000-4000-8000-00000000000f", "Encaminhar pedido ao produtor", [1320, 640], CODIGO.encaminharProdutor),
    code("a1000000-0000-4000-8000-000000000011", "Formatar início da produção", [1540, 640], CODIGO.respostaProdutor),
    // As etapas de agente levam minutos: responde ao painel primeiro e só então executa o produtor.
    // O modo "sem aguardar" (waitForSubWorkflow:false) não serve: nesta instalação a subexecução
    // nascia vazia (nenhum nó) e era marcada como sucesso (execução 693, 03/11/2026).
    {
      id: "a1000000-0000-4000-8000-000000000012",
      name: "Responder disparo ao painel",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [1760, 640],
      parameters: { respondWith: "json", responseBody: "={{ $json.resposta }}", options: { responseCode: "={{ $json.http_status }}" } },
    },
    code("a1000000-0000-4000-8000-000000000013", "Repassar pedido ao produtor", [1980, 640], CODIGO.repassarProdutor),
    {
      id: "a1000000-0000-4000-8000-000000000010",
      name: "Executar produtor",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.4,
      position: [2200, 640],
      // Sem saída de erro: uma falha do produtor torna esta execução do adaptador "erro",
      // e o adaptador guarda execuções com erro (saveDataErrorExecution: all).
      parameters: {
        source: "database",
        workflowId: { __rl: true, value: IDS.workflowProdutor, mode: "id" },
        mode: "once",
        options: { waitForSubWorkflow: true },
      },
    },
    ifNode("a1000000-0000-4000-8000-000000000014", "Leitura de pautas?", [1100, 760], "leitura_pautas"),
    lerContexto("a1000000-0000-4000-8000-000000000015", "Ler planos do cliente", [1320, 760], "plano", false),
    lerContexto("a1000000-0000-4000-8000-000000000016", "Ler propostas de fontes", [1540, 760], "fontes_pauta_proposta", true),
    lerContexto("a1000000-0000-4000-8000-000000000017", "Ler fontes aprovadas", [1760, 760], "fontes_pauta", true),
    code("a1000000-0000-4000-8000-000000000018", "Montar lista de pautas", [1980, 760], CODIGO.pautas),
    ifNode("a1000000-0000-4000-8000-000000000019", "Fontes em segundo plano?", [1320, 960], "fontes_async"),
    code("a1000000-0000-4000-8000-00000000001a", "Encaminhar pedido de fontes", [1540, 960], CODIGO.encaminharFontes),
    code("a1000000-0000-4000-8000-00000000001b", "Formatar aceite das fontes", [1760, 960], CODIGO.aceiteFontes),
    responder("a1000000-0000-4000-8000-00000000001c", "Responder aceite das fontes", [1980, 960]),
    code("a1000000-0000-4000-8000-00000000001d", "Repassar pedido de fontes", [2200, 960], CODIGO.repassarFontes),
    // Sem saída de erro: falha da curadoria vira erro do adaptador, que guarda execuções com erro.
    executar("a1000000-0000-4000-8000-00000000001e", "Executar curadoria de fontes", [2420, 960], IDS.workflowFontes, false),
    ifNode("a1000000-0000-4000-8000-00000000001f", "Aprovar fontes?", [1540, 1160], "fontes_sync"),
    code("a1000000-0000-4000-8000-000000000020", "Encaminhar aprovação de fontes", [1760, 1160], CODIGO.encaminharAprovacao),
    executar("a1000000-0000-4000-8000-000000000021", "Executar aprovação de fontes", [1980, 1160], IDS.workflowFontes, true),
    ifNode("a1000000-0000-4000-8000-000000000022", "Enfileirar pauta?", [1760, 1360], "enfileirador"),
    code("a1000000-0000-4000-8000-000000000023", "Encaminhar ao enfileirador", [1980, 1360], CODIGO.encaminharEnfileirador),
    executar("a1000000-0000-4000-8000-000000000024", "Executar enfileirador", [2200, 1360], IDS.workflowEnfileirador, true),
    {
      id: "a1000000-0000-4000-8000-00000000000b",
      name: "Responder ao painel",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [2000, 200],
      parameters: { respondWith: "json", responseBody: "={{ $json.resposta }}", options: { responseCode: "={{ $json.http_status }}" } },
    },
  ];

  const to = (node, index = 0) => ({ node, type: "main", index });
  const connections = {
    "Receber pedido do painel": { main: [[to("Validar pedido do painel")]] },
    "Validar pedido do painel": { main: [[to("Pedido recusado?")]] },
    "Pedido recusado?": { main: [[to("Responder ao painel")], [to("Leitura restrita?")]] },
    "Leitura restrita?": { main: [[to("Ler fila do escopo")], [to("Leitura de um trabalho?")]] },
    "Ler fila do escopo": { main: [[to("Leitura restrita da fila")]] },
    "Leitura de um trabalho?": { main: [[to("Ler trabalho do escopo")], [to("Leitura de pautas?")]] },
    "Leitura de pautas?": { main: [[to("Ler planos do cliente")], [to("Iniciar produção?")]] },
    "Ler planos do cliente": { main: [[to("Ler propostas de fontes")]] },
    "Ler propostas de fontes": { main: [[to("Ler fontes aprovadas")]] },
    "Ler fontes aprovadas": { main: [[to("Montar lista de pautas")]] },
    "Montar lista de pautas": { main: [[to("Responder ao painel")]] },
    "Fontes em segundo plano?": { main: [[to("Encaminhar pedido de fontes")], [to("Aprovar fontes?")]] },
    "Encaminhar pedido de fontes": { main: [[to("Formatar aceite das fontes")]] },
    "Formatar aceite das fontes": { main: [[to("Responder aceite das fontes")]] },
    "Responder aceite das fontes": { main: [[to("Repassar pedido de fontes")]] },
    "Repassar pedido de fontes": { main: [[to("Executar curadoria de fontes")]] },
    "Aprovar fontes?": { main: [[to("Encaminhar aprovação de fontes")], [to("Enfileirar pauta?")]] },
    "Encaminhar aprovação de fontes": { main: [[to("Executar aprovação de fontes")]] },
    "Executar aprovação de fontes": { main: [[to("Formatar resposta da fila")], [to("Formatar falha da fila")]] },
    "Enfileirar pauta?": { main: [[to("Encaminhar ao enfileirador")], [to("Encaminhar pedido à fila")]] },
    "Encaminhar ao enfileirador": { main: [[to("Executar enfileirador")]] },
    "Executar enfileirador": { main: [[to("Formatar resposta da fila")], [to("Formatar falha da fila")]] },
    "Ler trabalho do escopo": { main: [[to("Leitura restrita da fila")]] },
    "Iniciar produção?": { main: [[to("Encaminhar pedido ao produtor")], [to("Fontes em segundo plano?")]] },
    "Encaminhar pedido ao produtor": { main: [[to("Formatar início da produção")]] },
    "Formatar início da produção": { main: [[to("Responder disparo ao painel")]] },
    "Responder disparo ao painel": { main: [[to("Repassar pedido ao produtor")]] },
    "Repassar pedido ao produtor": { main: [[to("Executar produtor")]] },
    "Leitura restrita da fila": { main: [[to("Responder ao painel")]] },
    "Encaminhar pedido à fila": { main: [[to("Executar operação da fila")]] },
    "Executar operação da fila": { main: [[to("Formatar resposta da fila")], [to("Formatar falha da fila")]] },
    "Formatar resposta da fila": { main: [[to("Responder ao painel")]] },
    "Formatar falha da fila": { main: [[to("Responder ao painel")]] },
  };

  return {
    name: "Painel editorial - adaptador autenticado (v1)",
    description:
      "Ponte autenticada entre o painel editorial e a fila V2 (8zHUZGYSA0nPhMWI) / produtor (Kk56hrmdN3ljNUh0). Operações: consultar, salvar_edicao, decidir, preparar_correcao, retomar_producao (responde ao painel e executa o produtor, com autorização de cobrança), ler_trabalho, ler_versao, ler_resumos, listar_pautas, propor_fontes (curadoria MafraFontesPauta, com autorização de cobrança), aprovar_fontes, enfileirar_pauta (Enfileirador 1Y2tf9mzggbGIpHZ).",
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: false,
      saveExecutionProgress: false,
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "all",
      // O n8n limita uma subexecução ao menor entre o timeout dela e o de quem a disparou,
      // mesmo sem aguardar. Com 120 s, o produtor (até 1800 s) seria cortado no meio de uma
      // etapa paga. O painel tem seu próprio limite de espera (N8N_ADAPTADOR_TIMEOUT_MS).
      executionTimeout: 1900,
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
