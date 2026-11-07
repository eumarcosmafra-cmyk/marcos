#!/usr/bin/env node
// Monta o workflow "Painel editorial - fontes da pauta" a partir de n8n/fontes/*.js.
// Uso: node scripts/montar-fontes.mjs [--saida=arquivo.json]
// Credenciais referenciadas pelo id (as mesmas que o Pesquisador já usa); nenhum segredo aqui.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(raiz, "n8n", "fontes");
const arg = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const ler = (f) => readFileSync(join(dir, f), "utf8");
const sha = readFileSync(join(raiz, "n8n", "adaptador", "_sha256.js"), "utf8");
const LIB = ler("_lib.js").replace("// __SHA256__", sha);
const comLib = (f) => `${LIB}\n// ---- ${f} ----\n${ler(f)}`;

export const CODIGO_FONTES = {
  validar: comLib("validar.js"),
  conferirPlano: comLib("conferir-plano.js"),
  prepararCandidatos: comLib("preparar-candidatos.js"),
  resolverDestinos: comLib("resolver-destinos.js"),
  recortar: comLib("recortar.js"),
  juntarModelo: ler("juntar-modelo.js"),
  montarProposta: comLib("montar-proposta.js"),
  conferirProposta: comLib("conferir-proposta.js"),
  entregarProposta: ler("entregar-proposta.js"),
  entregarAprovacao: ler("entregar-aprovacao.js"),
  recusa: ler("recusa.js"),
};

export const IDS_FONTES = {
  workflow: "MafraFontesPauta",
  tabela: "I0kHnbGg35Y9RA5Y",
  credCrawl: { id: "Sgo0jf5agazPBBrE", name: "TIME DE SEO - Crawl4AI" },
  credDeepseek: { id: "d95UxQ6gv0xfESqm", name: "OpenAI account 2" },
};

const COLUNAS = ["cache_key", "cliente_id", "site_url", "site_snapshot", "tipo", "payload_json", "payload_sha256", "consultado_em", "atualizado_em"];

export function montarWorkflowFontes() {
  let n = 0;
  const id = () => `f0000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const code = (name, position, jsCode) => ({ id: id(), name, type: "n8n-nodes-base.code", typeVersion: 2, position, parameters: { mode: "runOnceForAllItems", language: "javaScript", jsCode } });
  const se = (name, position, expr) => ({
    id: id(),
    name,
    type: "n8n-nodes-base.if",
    typeVersion: 2.4,
    position,
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 4 },
        conditions: [{ id: id(), leftValue: `={{ ${expr} }}`, rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
        combinator: "and",
      },
      options: {},
    },
  });
  const tabela = { __rl: true, value: IDS_FONTES.tabela, mode: "id", cachedResultName: "SEO - Contextos e pesquisa" };
  const ler = (name, position, chave, tipo) => ({
    id: id(),
    name,
    type: "n8n-nodes-base.dataTable",
    typeVersion: 1.1,
    position,
    alwaysOutputData: true,
    onError: "continueRegularOutput",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: tabela,
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "cache_key", condition: "eq", keyValue: `={{ ${chave} }}` },
          { keyName: "cliente_id", condition: "eq", keyValue: '={{ $("Validar pedido").first().json.request.cliente_id }}' },
          { keyName: "tipo", condition: "eq", keyValue: tipo },
        ],
      },
      returnAll: false,
      limit: 2,
    },
  });
  const gravar = (name, position) => ({
    id: id(),
    name,
    type: "n8n-nodes-base.dataTable",
    typeVersion: 1.1,
    position,
    alwaysOutputData: true,
    parameters: {
      resource: "row",
      operation: "upsert",
      dataTableId: tabela,
      matchType: "allConditions",
      filters: {
        conditions: ["cache_key", "cliente_id", "tipo"].map((k) => ({ keyName: k, condition: "eq", keyValue: `={{ $json.${k} }}` })),
      },
      columns: {
        mappingMode: "defineBelow",
        value: Object.fromEntries(COLUNAS.map((c) => [c, `={{ $json.${c} }}`])),
        schema: COLUNAS.map((c) => ({ id: c, displayName: c, type: /_em$/.test(c) ? "dateTime" : "string", display: true, required: false, defaultMatch: false, readOnly: false, removed: false })),
      },
    },
  });
  const coletar = (name, position, nota) => ({
    id: id(),
    name,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.5,
    position,
    notesInFlow: true,
    notes: nota,
    onError: "continueRegularOutput",
    parameters: {
      method: "POST",
      url: "http://crawl4ai:11235/crawl",
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth",
      sendBody: true,
      specifyBody: "json",
      jsonBody: "={{ $json.crawl }}",
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 500 } },
        response: { response: { responseFormat: "json", fullResponse: true, neverError: true } },
        timeout: 120000,
        redirect: { redirect: { followRedirects: false } },
      },
    },
    credentials: { httpHeaderAuth: IDS_FONTES.credCrawl },
  });

  const nodes = [
    { id: id(), name: "Receber pedido de fontes", type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1.3, position: [0, 300], parameters: { inputSource: "passthrough" } },
    code("Validar pedido", [220, 300], CODIGO_FONTES.validar),
    se("Pedido válido?", [440, 300], "$json.ok === true"),
    ler("Ler plano", [660, 200], '$("Validar pedido").first().json.request.plano_cache_key', "plano"),
    code("Conferir plano", [880, 200], CODIGO_FONTES.conferirPlano),
    se("Plano conferido?", [1100, 200], "$json.ok === true"),
    se("Modo aprovar?", [1320, 120], '$json.modo === "aprovar"'),
    code("Preparar candidatos", [1540, 320], CODIGO_FONTES.prepararCandidatos),
    coletar("Coletar candidatos", [1760, 320], "1ª coleta: revela o endereço final de cada resultado da SERP."),
    code("Resolver destinos", [1980, 320], CODIGO_FONTES.resolverDestinos),
    coletar("Confirmar destinos", [2200, 320], "2ª coleta no endereço final, igual à que o Pesquisador fará."),
    code("Recortar e preparar escolha", [2420, 320], CODIGO_FONTES.recortar),
    se("Usar modelo?", [2640, 320], "$json.usar_modelo === true"),
    {
      id: id(),
      name: "Escolher fontes com DeepSeek",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.5,
      position: [2860, 240],
      notesInFlow: true,
      notes: "Uma chamada: escolhe 3 entre páginas já coletadas e escreve entidade e limites. Falha cai na escolha automática.",
      onError: "continueRegularOutput",
      parameters: {
        method: "POST",
        url: "https://api.deepseek.com/responses",
        authentication: "predefinedCredentialType",
        nodeCredentialType: "openAiApi",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ $json.body }}",
        options: { timeout: 300000, redirect: { redirect: { followRedirects: false } }, response: { response: { responseFormat: "json" } } },
      },
      credentials: { openAiApi: IDS_FONTES.credDeepseek },
    },
    code("Juntar resposta do modelo", [3080, 240], CODIGO_FONTES.juntarModelo),
    code("Montar proposta", [3300, 320], CODIGO_FONTES.montarProposta),
    gravar("Gravar proposta", [3520, 320]),
    code("Entregar proposta", [3740, 320], CODIGO_FONTES.entregarProposta),
    ler("Ler proposta", [1540, 40], '$("Conferir plano").first().json.fontes_cache_key', "fontes_pauta_proposta"),
    code("Conferir proposta", [1760, 40], CODIGO_FONTES.conferirProposta),
    se("Proposta conferida?", [1980, 40], "$json.ok === true"),
    gravar("Gravar fontes aprovadas", [2200, -40]),
    code("Entregar aprovação", [2420, -40], CODIGO_FONTES.entregarAprovacao),
    code("Entregar recusa", [2420, 560], CODIGO_FONTES.recusa),
  ];

  const to = (node) => ({ node, type: "main", index: 0 });
  const connections = {
    "Receber pedido de fontes": { main: [[to("Validar pedido")]] },
    "Validar pedido": { main: [[to("Pedido válido?")]] },
    "Pedido válido?": { main: [[to("Ler plano")], [to("Entregar recusa")]] },
    "Ler plano": { main: [[to("Conferir plano")]] },
    "Conferir plano": { main: [[to("Plano conferido?")]] },
    "Plano conferido?": { main: [[to("Modo aprovar?")], [to("Entregar recusa")]] },
    "Modo aprovar?": { main: [[to("Ler proposta")], [to("Preparar candidatos")]] },
    "Preparar candidatos": { main: [[to("Coletar candidatos")]] },
    "Coletar candidatos": { main: [[to("Resolver destinos")]] },
    "Resolver destinos": { main: [[to("Confirmar destinos")]] },
    "Confirmar destinos": { main: [[to("Recortar e preparar escolha")]] },
    "Recortar e preparar escolha": { main: [[to("Usar modelo?")]] },
    "Usar modelo?": { main: [[to("Escolher fontes com DeepSeek")], [to("Montar proposta")]] },
    "Escolher fontes com DeepSeek": { main: [[to("Juntar resposta do modelo")]] },
    "Juntar resposta do modelo": { main: [[to("Montar proposta")]] },
    "Montar proposta": { main: [[to("Gravar proposta")]] },
    "Gravar proposta": { main: [[to("Entregar proposta")]] },
    "Ler proposta": { main: [[to("Conferir proposta")]] },
    "Conferir proposta": { main: [[to("Proposta conferida?")]] },
    "Proposta conferida?": { main: [[to("Gravar fontes aprovadas")], [to("Entregar recusa")]] },
    "Gravar fontes aprovadas": { main: [[to("Entregar aprovação")]] },
  };

  return {
    id: IDS_FONTES.workflow,
    name: "Painel editorial - fontes da pauta (curadoria)",
    description:
      "Propõe 3 fontes por pauta (SERP do plano + URLs do editor → Crawl4AI → recorte por código → escolha pelo DeepSeek) e grava a aprovação do editor como fontes_pauta, lida pelo Enfileirador 1Y2tf9mzggbGIpHZ.",
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      saveManualExecutions: false,
      saveExecutionProgress: false,
      saveDataSuccessExecution: "none",
      saveDataErrorExecution: "all",
      executionTimeout: 900,
      timezone: "America/Sao_Paulo",
      callerPolicy: "workflowsFromSameOwner",
    },
    pinData: {},
    tags: [],
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const wf = montarWorkflowFontes();
  const saida = arg("saida") ?? join(raiz, "n8n", "fontes-pauta.workflow.json");
  writeFileSync(saida, JSON.stringify(wf, null, 2) + "\n");
  console.log(`Workflow gravado em ${saida} (${wf.nodes.length} nós).`);
}
