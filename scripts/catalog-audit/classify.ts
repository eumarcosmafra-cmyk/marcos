/**
 * Classifica o catálogo inteiro a partir dos slugs do sitemap (sem API, sem crawl de páginas).
 * Saída: tipo de peça, sistema, marca, modelo e anos por produto + matriz Marca × Modelo × Sistema.
 *
 * Uso:
 *   npm run audit:classificar -- --site https://www.loja.com.br
 *   npm run audit:classificar -- --arquivo urls.txt      (uma URL por linha)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { ClienteHttp } from "./http"
import { lerUrlsDoIndice } from "./sitemap"
import { SEM_SISTEMA, DicionarioModelos, chaveModelo, classificarComMarca, classificarSemMarca, detectarMarca, tokenizar, type Classificacao } from "./taxonomy"

const CORTES = [5, 10, 20, 50, 100]

function csv(linhas: (string | number | null)[][]): string {
  const celula = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n"
}

const pct = (n: number, total: number) => `${((n / (total || 1)) * 100).toFixed(1).replace(".", ",")}%`
const fmt = (n: number) => n.toLocaleString("pt-BR")
const titulo = (s: string) => s.replace(/(^|\s)([a-z])/g, (m) => m.toUpperCase())

function contar<K>(itens: K[]): Map<K, number> {
  const m = new Map<K, number>()
  for (const k of itens) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

async function carregarUrls(site: string | undefined, arquivo: string | undefined): Promise<string[]> {
  if (arquivo) return readFileSync(arquivo, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!site) throw new Error("Informe --site ou --arquivo")
  const http = new ClienteHttp({ userAgent: "Mozilla/5.0 (compatible; MPL-CatalogAudit/0.1)", timeoutMs: 120_000, delayMs: 1000, maxTentativas: 4 })
  const { filhos, urls } = await lerUrlsDoIndice(http, `${new URL(site).origin}/sitemap.xml`, /produto|product/i)
  console.log(`[classify] ${urls.length} URLs de ${filhos.length} sitemaps de produto`)
  return urls
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      site: { type: "string" },
      arquivo: { type: "string" },
      saida: { type: "string" },
      "min-modelo": { type: "string" },
    },
  })
  const urls = Array.from(new Set(await carregarUrls(values.site, values.arquivo)))
  const host = new URL(urls[0] ?? values.site ?? "https://desconhecido").host
  const saida = values.saida ?? join("output", "catalog-audit", `${host}-classificacao`)
  mkdirSync(saida, { recursive: true })
  writeFileSync(join(saida, "urls-produto.txt"), urls.join("\n") + "\n")

  // 1ª passada: slugs com marca + aprendizado modelo -> marca
  const dicionario = new DicionarioModelos()
  const resultado: (Classificacao | null)[] = new Array(urls.length).fill(null)
  const tokensPorUrl: string[][] = []
  urls.forEach((u, i) => {
    const caminho = new URL(u).pathname.replace(/^\/+|\/+$/g, "")
    const tokens = tokenizar(caminho)
    tokensPorUrl[i] = tokens
    const achado = detectarMarca(tokens)
    if (!achado) return
    const c = classificarComMarca(u, tokens, achado)
    resultado[i] = c
    if (c.modelo && c.marca) dicionario.registrar(c.modelo, c.marca)
  })
  const minModelo = Number(values["min-modelo"] ?? 5)
  const modelosConhecidos = dicionario.consolidar(Number.isFinite(minModelo) ? minModelo : 5)
  const familias = dicionario.familias(20)

  // 2ª passada: slugs sem marca -> modelo conhecido
  urls.forEach((u, i) => {
    if (!resultado[i]) resultado[i] = classificarSemMarca(u, tokensPorUrl[i], modelosConhecidos, familias)
  })
  const itens = resultado.filter((c): c is Classificacao => c !== null)
  const total = itens.length

  // Agrupa variantes do mesmo modelo ("r1 yzf" = "yzf r1") e exibe a mais frequente
  const variantes = new Map<string, Map<string, number>>()
  for (const c of itens) {
    if (!c.marca || !c.modelo) continue
    const k = `${c.marca}\u0001${chaveModelo(c.modelo)}`
    const v = variantes.get(k) ?? new Map<string, number>()
    v.set(c.modelo, (v.get(c.modelo) ?? 0) + 1)
    variantes.set(k, v)
  }
  const nomeAgrupado = new Map<string, string>()
  for (const [k, v] of variantes) nomeAgrupado.set(k, Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0][0])
  const agrupado = (c: Classificacao): string | null => (c.marca && c.modelo ? nomeAgrupado.get(`${c.marca}\u0001${chaveModelo(c.modelo)}`) ?? c.modelo : null)

  writeFileSync(
    join(saida, "classificacao-produtos.csv"),
    csv([
      ["url", "tipo_peca", "sistema", "marca", "fonte_marca", "modelo_bruto", "modelo_agrupado", "anos", "codigo", "com_detalhe"],
      ...itens.map((c) => [c.url, c.tipoPeca, c.sistema, c.marca, c.fonteMarca, c.modelo, agrupado(c), c.anos, c.codigo, c.comDetalhe ? "sim" : ""]),
    ]),
  )

  // Matriz Marca × Modelo × Sistema
  const chave = (c: Classificacao) => `${c.marca}\u0001${agrupado(c)}\u0001${c.sistema}`
  const comModelo = itens.filter((c) => c.marca && c.modelo)
  const matriz = contar(comModelo.map(chave))
  const linhasMatriz = Array.from(matriz.entries())
    .map(([k, n]) => [...k.split("\u0001"), n] as [string, string, string, number])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || b[3] - a[3])
  writeFileSync(join(saida, "matriz-marca-modelo-sistema.csv"), csv([["marca", "modelo", "sistema", "produtos"], ...linhasMatriz]))

  // Modelos (para curadoria de nomes canônicos)
  const porModelo = contar(comModelo.map((c) => `${c.marca}\u0001${agrupado(c)}`))
  const linhasModelos = Array.from(porModelo.entries())
    .map(([k, n]) => [...k.split("\u0001"), n] as [string, string, number])
    .sort((a, b) => b[2] - a[2])
  writeFileSync(join(saida, "modelos.csv"), csv([["marca", "modelo_agrupado", "produtos", "modelo_canonico (preencher)"], ...linhasModelos.map((l) => [...l, ""])]))

  // Tipos de peça por sistema (para revisar o mapeamento)
  const porTipo = contar(itens.map((c) => `${c.tipoPeca}\u0001${c.sistema}`))
  const linhasTipos = Array.from(porTipo.entries())
    .map(([k, n]) => [...k.split("\u0001"), n] as [string, string, number])
    .sort((a, b) => b[2] - a[2])
  writeFileSync(join(saida, "tipos-por-sistema.csv"), csv([["tipo_peca", "sistema", "produtos"], ...linhasTipos]))

  // Resumo
  const comMarcaSlug = itens.filter((c) => c.fonteMarca === "slug").length
  const comMarcaModelo = itens.filter((c) => c.fonteMarca === "modelo").length
  const comMarcaFamilia = itens.filter((c) => c.fonteMarca === "familia").length
  const semSistema = itens.filter((c) => c.sistema === SEM_SISTEMA).length
  const porMarca = Array.from(contar(itens.map((c) => c.marca ?? "(sem marca)")).entries()).sort((a, b) => b[1] - a[1])
  const porSistema = Array.from(contar(itens.map((c) => c.sistema)).entries()).sort((a, b) => b[1] - a[1])
  const md: string[] = []
  md.push(`# Classificação do catálogo por slug: ${host}`, "")
  md.push(`- Produtos (URLs únicas no sitemap): ${fmt(total)}`)
  md.push(`- Marca encontrada no slug: ${fmt(comMarcaSlug)} (${pct(comMarcaSlug, total)})`)
  md.push(`- Marca inferida pelo modelo: ${fmt(comMarcaModelo)} (${pct(comMarcaModelo, total)})`)
  md.push(`- Marca inferida pela família do modelo: ${fmt(comMarcaFamilia)} (${pct(comMarcaFamilia, total)})`)
  const semMarca = total - comMarcaSlug - comMarcaModelo - comMarcaFamilia
  md.push(`- Sem marca identificada: ${fmt(semMarca)} (${pct(semMarca, total)})`)
  md.push(`- Com modelo identificado: ${fmt(comModelo.length)} (${pct(comModelo.length, total)})`)
  md.push(`- Com sistema identificado: ${fmt(total - semSistema)} (${pct(total - semSistema, total)})`)
  md.push(`- Modelos distintos (agrupados por palavras, antes de curadoria): ${fmt(porModelo.size)} | dicionário usado na inferência: ${fmt(modelosConhecidos.size)} modelos e ${fmt(familias.size)} famílias`, "")

  md.push("## Produtos por marca", "", "| Marca | Produtos | % |", "|---|---|---|")
  for (const [m, n] of porMarca) md.push(`| ${titulo(m)} | ${fmt(n)} | ${pct(n, total)} |`)
  md.push("", "## Produtos por sistema", "", "| Sistema | Produtos | % |", "|---|---|---|")
  for (const [s, n] of porSistema) md.push(`| ${s} | ${fmt(n)} | ${pct(n, total)} |`)

  md.push("", "## Corte por volume (quantos nós sobrevivem como categoria)", "")
  md.push("Nós com pelo menos N produtos e quantos produtos eles cobrem. Base: produtos com marca e modelo identificados.", "")
  md.push("| N mínimo | Modelos (Marca > Modelo) | Produtos cobertos | Nós Modelo > Sistema | Produtos cobertos |", "|---|---|---|---|---|")
  for (const n of CORTES) {
    const modelosOk = linhasModelos.filter((l) => l[2] >= n)
    const nosOk = linhasMatriz.filter((l) => l[2] !== SEM_SISTEMA && l[3] >= n)
    const cobModelos = modelosOk.reduce((a, l) => a + l[2], 0)
    const cobNos = nosOk.reduce((a, l) => a + l[3], 0)
    md.push(`| ${n} | ${fmt(modelosOk.length)} | ${fmt(cobModelos)} (${pct(cobModelos, comModelo.length)}) | ${fmt(nosOk.length)} | ${fmt(cobNos)} (${pct(cobNos, comModelo.length)}) |`)
  }

  md.push("", "## Top 25 modelos", "", "| Marca | Modelo | Produtos |", "|---|---|---|")
  for (const l of linhasModelos.slice(0, 25)) md.push(`| ${titulo(l[0])} | ${l[1].toUpperCase()} | ${fmt(l[2])} |`)

  md.push("", "## Top 25 tipos de peça sem sistema (para ajustar regras em taxonomy.ts)", "", "| Tipo | Produtos |", "|---|---|")
  for (const l of linhasTipos.filter((l) => l[1] === SEM_SISTEMA).slice(0, 25)) md.push(`| ${l[0] || "(vazio)"} | ${fmt(l[2])} |`)

  md.push(
    "",
    "## Limitações",
    "",
    "- Fonte: só o slug da URL. Nome, descrição e categorias reais virão da API (passo seguinte).",
    "- Modelo agrupado só por ordem de palavras: variantes com palavras diferentes seguem separadas (ex.: \"zx 10\" e \"zx 10r\"; \"cbr 1000 rr\" e \"cbr 1000 rr fireblade\"). Use `modelos.csv` para definir o nome canônico.",
    "- Sistemas e regras de classificação são proposta (`taxonomy.ts`); a taxonomia final é decisão de negócio.",
    "- Sitemap pode não conter produtos inativos ou fora de estoque.",
    "",
  )
  writeFileSync(join(saida, "resumo-classificacao.md"), md.join("\n"))
  console.log(`[classify] ${fmt(total)} produtos classificados -> ${saida}`)
}

main().catch((e) => {
  console.error("[classify] Erro fatal:", e)
  process.exitCode = 1
})
