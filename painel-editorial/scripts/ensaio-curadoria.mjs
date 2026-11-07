#!/usr/bin/env node
// ENSAIO da curadoria contra páginas REAIS, antes de implantar. Só leitura: não grava, não chama modelo.
// Roda o mesmo código dos nós do workflow (n8n/fontes) com o Crawl4AI real e, para as 3 fontes
// propostas, coleta cada página mais N vezes como o Pesquisador fará e confere se o trecho é achado.
//
// Uso (na VPS, num container na rede n8n_default):
//   CRAWL4AI_HEADER=<nome do cabeçalho> CRAWL4AI_TOKEN=<valor> \
//   node scripts/ensaio-curadoria.mjs --plano=linha-plano.json --pauta=P003 [--repeticoes=2] [--extras=https://a/,https://b/]
// linha-plano.json: a linha da I0kHnbGg35Y9RA5Y (tipo plano) com id, tipo, cache_key, cliente_id, payload_json, payload_sha256.
import { readFileSync } from "node:fs";
import { CODIGO_FONTES } from "./montar-fontes.mjs";

const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=") ?? d;
const URL_CRAWL = process.env.CRAWL4AI_URL || "http://crawl4ai:11235/crawl";
const HEADER = process.env.CRAWL4AI_HEADER;
const TOKEN = process.env.CRAWL4AI_TOKEN;
if (!HEADER || !TOKEN) throw new Error("Defina CRAWL4AI_HEADER e CRAWL4AI_TOKEN (não são impressos).");

const linha = JSON.parse(readFileSync(arg("plano"), "utf8"));
const pautaId = arg("pauta");
const repeticoes = Number(arg("repeticoes", "2"));
const extras = (arg("extras", "") || "").split(",").map((u) => u.trim()).filter(Boolean);

const lib = new Function(`${CODIGO_FONTES.validar.split("// ---- validar.js ----")[0]}; return { fRecorte, fResultadoCrawl, fCrawl, fEscolhaAutomatica };`)();
const rodar = (js, entrada, refs) => {
  const $input = { all: () => entrada.map((json) => ({ json })), first: () => ({ json: entrada[0] }) };
  const $ = (nome) => ({ first: () => ({ json: refs[nome][0] }), all: () => refs[nome].map((json) => ({ json })) });
  return new Function("$input", "$", "$execution", js)($input, $, { id: "ensaio" }).map((i) => i.json);
};
async function coletar(corpo) {
  try {
    const res = await fetch(URL_CRAWL, { method: "POST", headers: { "Content-Type": "application/json", [HEADER]: TOKEN }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(120000) });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { statusCode: res.status, body };
  } catch (e) {
    return { statusCode: 0, body: { success: false, erro: String(e.message || e) } };
  }
}
async function emSerie(itens) {
  const out = [];
  for (const it of itens) out.push(await coletar(it.crawl));
  return out;
}

const refs = {};
const pedido = { modo: "propor", cliente_id: linha.cliente_id, plano_cache_key: linha.cache_key, pauta_id: pautaId, ator_id: "marcos_mafra", autorizar_cobranca: true, urls_extras: extras };
refs["Validar pedido"] = rodar(CODIGO_FONTES.validar, [pedido], refs);
if (!refs["Validar pedido"][0].ok) throw new Error("pedido: " + refs["Validar pedido"][0].codigo);
refs["Conferir plano"] = rodar(CODIGO_FONTES.conferirPlano, [linha], refs);
if (!refs["Conferir plano"][0].ok) throw new Error("plano: " + refs["Conferir plano"][0].codigo);
refs["Preparar candidatos"] = rodar(CODIGO_FONTES.prepararCandidatos, [refs["Conferir plano"][0]], refs);
refs["Resolver destinos"] = rodar(CODIGO_FONTES.resolverDestinos, await emSerie(refs["Preparar candidatos"]), refs);
const rec = rodar(CODIGO_FONTES.recortar, await emSerie(refs["Resolver destinos"]), refs);
refs["Recortar e preparar escolha"] = rec;
// Sem modelo: escolha automática (o ensaio não gasta chamadas pagas).
const proposta = JSON.parse(rodar(CODIGO_FONTES.montarProposta, rec, refs)[0].payload_json);

const relatorio = {
  pauta: pautaId,
  status: proposta.status,
  motivo: proposta.motivo,
  candidatos: proposta.candidatos.map((c) => ({ id: c.id, dominio: c.dominio, situacao: c.situacao, motivo: c.motivo, fonte: c.fonte || null })),
  fontes: [],
};
if (proposta.fontes) {
  for (const d of proposta.fontes.documentos) {
    const verif = [];
    for (let i = 0; i < repeticoes; i += 1) {
      const r = lib.fResultadoCrawl(await coletar(lib.fCrawl(d.url)));
      if (!r.ok) { verif.push({ ok: false, motivo: r.motivo }); continue; }
      if (r.url_final !== d.url) { verif.push({ ok: false, motivo: "endereco_mudou" }); continue; }
      const c = lib.fRecorte(r.markdown, d);
      verif.push(c.ok ? { ok: true, caracteres: c.texto.length } : { ok: false, motivo: c.motivo });
    }
    const p = proposta.previas.find((x) => x.id === d.id);
    relatorio.fontes.push({ id: d.id, dominio: new URL(d.url).host, localizador: d.localizador, caracteres_na_proposta: p ? p.caracteres : null, recoletas: verif, estavel: verif.every((v) => v.ok) });
  }
}
relatorio.aprovado_no_ensaio = proposta.status === "pronta" && relatorio.fontes.length === 3 && relatorio.fontes.every((f) => f.estavel);
console.log(JSON.stringify(relatorio, null, 2));
process.exit(relatorio.aprovado_no_ensaio ? 0 : 1);
