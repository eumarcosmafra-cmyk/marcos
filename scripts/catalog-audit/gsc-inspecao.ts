/**
 * Amostra de Inspeção de URL (API do Search Console, somente leitura): status real de indexação de produtos
 * com e sem impressões, para separar "não indexado" de "indexado sem demanda".
 * Cota da API: 2.000 inspeções/dia por propriedade. Ritmo: 1 por segundo.
 *
 * Uso: npm run audit:gsc-inspecao -- --site https://www.loja.com.br/ [--sem 150] [--com 50]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"
import { Limitador } from "./http"
import { amostrar } from "./sitemap"

interface Resultado {
  url: string
  grupo: string
  coverageState: string
  verdict: string
  pageFetchState: string
  indexingState: string
  robotsTxtState: string
  lastCrawlTime: string
  googleCanonical: string
  userCanonical: string
  referring: string
}
const csvExcel = (linhas: (string | number)[][]) =>
  "﻿" + linhas.map((l) => l.map((v) => { const s = String(v ?? ""); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(";")).join("\r\n") + "\r\n"

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { site: { type: "string" }, sem: { type: "string" }, com: { type: "string" }, saida: { type: "string" } } })
  if (!values.site) throw new Error("Informe --site")
  const saida = values.saida ?? join("output", "catalog-audit", "gsc-api")
  const urls = readFileSync(join("output", "catalog-audit", "classificacao", "urls-produto.txt"), "utf-8").split("\n").filter(Boolean).map((u) => u.replace(/\.br\/\/+/, ".br/"))
  const paginas = lerCsv(readFileSync(join(saida, "Páginas.csv"), "utf-8"), ",")
  const comImpressao = new Set(paginas.map((r) => r["Páginas principais"].split("?")[0].replace(/\.br\/\/+/, ".br/")))
  const sem = amostrar(urls.filter((u) => !comImpressao.has(u)), Number(values.sem ?? 150))
  const com = amostrar(urls.filter((u) => comImpressao.has(u)), Number(values.com ?? 50))
  const fila = [...sem.map((u) => ({ url: u, grupo: "sem impressão" })), ...com.map((u) => ({ url: u, grupo: "com impressão" }))]
  const limitador = new Limitador(1000)
  const out: Resultado[] = []
  for (const [i, f] of fila.entries()) {
    await limitador.aguardar()
    try {
      const res = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl: f.url, siteUrl: values.site, languageCode: "pt-BR" }),
        signal: AbortSignal.timeout(60_000),
      })
      const j = (await res.json()) as { inspectionResult?: { indexStatusResult?: Record<string, unknown> }; error?: { message?: string } }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${j.error?.message ?? ""}`)
      const s = j.inspectionResult?.indexStatusResult ?? {}
      const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "")
      out.push({
        url: f.url, grupo: f.grupo, coverageState: str("coverageState"), verdict: str("verdict"), pageFetchState: str("pageFetchState"),
        indexingState: str("indexingState"), robotsTxtState: str("robotsTxtState"), lastCrawlTime: str("lastCrawlTime").slice(0, 10),
        googleCanonical: str("googleCanonical"), userCanonical: str("userCanonical"),
        referring: Array.isArray(s.referringUrls) ? (s.referringUrls as string[]).slice(0, 2).join(" | ") : "",
      })
    } catch (e) {
      console.error(`[inspecao] ${f.url}:`, e instanceof Error ? e.message : e)
      out.push({ url: f.url, grupo: f.grupo, coverageState: "ERRO NA CONSULTA", verdict: "", pageFetchState: "", indexingState: "", robotsTxtState: "", lastCrawlTime: "", googleCanonical: "", userCanonical: "", referring: "" })
    }
    if ((i + 1) % 25 === 0) console.log(`[inspecao] ${i + 1}/${fila.length}`)
  }
  writeFileSync(join(saida, "inspecao-amostra.csv"), csvExcel([["grupo", "url", "estado", "veredito", "busca_da_pagina", "rastreio", "canonical_google", "canonical_declarado", "links_que_apontam"], ...out.map((r) => [r.grupo, r.url, r.coverageState, r.verdict, r.pageFetchState, r.lastCrawlTime, r.googleCanonical, r.userCanonical, r.referring])]))
  for (const g of ["sem impressão", "com impressão"]) {
    const doGrupo = out.filter((r) => r.grupo === g)
    const cont = new Map<string, number>()
    for (const r of doGrupo) cont.set(r.coverageState, (cont.get(r.coverageState) ?? 0) + 1)
    console.log(`\n== ${g} (${doGrupo.length})`)
    for (const [k, n] of Array.from(cont.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n} (${((n / doGrupo.length) * 100).toFixed(0)}%)`)
    const canonDif = doGrupo.filter((r) => r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical).length
    console.log(`  canonical do Google ≠ declarado: ${canonDif}`)
  }
}

main().catch((e) => {
  console.error("[inspecao] Erro fatal:", e)
  process.exitCode = 1
})
