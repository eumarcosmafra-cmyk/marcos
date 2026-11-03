import * as cheerio from "cheerio"
import type { BreadcrumbItem, DadosBase, DadosCategoria, DadosProduto } from "./types"

type Obj = Record<string, unknown>

const ehObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v)
const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)
const limpar = (s: string | undefined | null): string | null => {
  const t = (s ?? "").replace(/\s+/g, " ").trim()
  return t || null
}

function resolver(url: string | null, base: string): string | null {
  if (!url) return null
  try {
    return new URL(url, base).toString()
  } catch (e) {
    console.error("[extract] URL inválida no breadcrumb:", url, e)
    return null
  }
}

function tipos(no: Obj): string[] {
  const t = no["@type"]
  if (typeof t === "string") return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string")
  return []
}

/** Achata JSON-LD: arrays, @graph e objetos aninhados de primeiro nível. */
function coletarNos(valor: unknown, saida: Obj[]): void {
  if (Array.isArray(valor)) {
    for (const v of valor) coletarNos(v, saida)
    return
  }
  if (!ehObj(valor)) return
  saida.push(valor)
  if (Array.isArray(valor["@graph"])) coletarNos(valor["@graph"], saida)
}

function lerJsonLd($: cheerio.CheerioAPI): { nos: Obj[]; invalidos: number } {
  const nos: Obj[] = []
  let invalidos = 0
  $('script[type="application/ld+json"]').each((_, el) => {
    const bruto = $(el).contents().text()
    try {
      coletarNos(JSON.parse(bruto), nos)
    } catch (e) {
      invalidos++
      console.error("[extract] JSON-LD inválido:", e instanceof Error ? e.message : e)
    }
  })
  return { nos, invalidos }
}

function breadcrumbDoJsonLd(nos: Obj[], base: string): BreadcrumbItem[] | null {
  const lista = nos.find((n) => tipos(n).includes("BreadcrumbList"))
  if (!lista || !Array.isArray(lista.itemListElement)) return null
  const elementos = lista.itemListElement.filter(ehObj)
  elementos.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
  return elementos.map((el) => {
    const item = el.item
    let nome = texto(el.name)
    let url: string | null = null
    if (typeof item === "string") url = item
    else if (ehObj(item)) {
      url = texto(item["@id"]) ?? texto(item.url)
      nome = nome ?? texto(item.name)
    }
    return { nome: nome ?? "", url: resolver(url, base) }
  })
}

/** Recorta um literal JSON ([...] ou {...}) começando em `inicio`, respeitando strings. */
export function fatiarJson(s: string, inicio: number): string | null {
  let profundidade = 0
  let emString = false
  let escape = false
  for (let i = inicio; i < s.length; i++) {
    const c = s[i]
    if (emString) {
      if (escape) escape = false
      else if (c === "\\") escape = true
      else if (c === '"') emString = false
      continue
    }
    if (c === '"') emString = true
    else if (c === "[" || c === "{") profundidade++
    else if (c === "]" || c === "}") {
      profundidade--
      if (profundidade === 0) return s.slice(inicio, i + 1)
    }
  }
  return null
}

/** Magazord embute `breadcrumb: [{id, id_pai, nome, url}]` no script da página de produto. */
function breadcrumbDaPlataforma(html: string, base: string): BreadcrumbItem[] | null {
  const m = /\bbreadcrumb:\s*\[/.exec(html)
  if (!m) return null
  const bruto = fatiarJson(html, m.index + m[0].length - 1)
  if (!bruto) return null
  try {
    const arr: unknown = JSON.parse(bruto)
    if (!Array.isArray(arr)) return null
    return arr.filter(ehObj).map((it) => ({
      nome: texto(it.nome) ?? "",
      url: resolver(texto(it.url), base),
      id: typeof it.id === "number" ? it.id : null,
      idPai: typeof it.id_pai === "number" ? it.id_pai : null,
    }))
  } catch (e) {
    console.error("[extract] breadcrumb da plataforma ilegível:", e instanceof Error ? e.message : e)
    return null
  }
}

/** "Marca: DUCATI Modelo: MULTISTRADA V4 RALLY Compatibilidade: 2023, 2024, 2025" (texto da descrição). */
function compatibilidade(descricao: string | null): { marca: string | null; modelo: string | null; anos: string | null } {
  const vazio = { marca: null, modelo: null, anos: null }
  if (!descricao) return vazio
  const t = descricao.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  const m = /Marca:\s*(.+?)\s+Modelo:\s*(.+?)\s+Compatibilidade:\s*([\d][\d,\s/–-]*\d)/i.exec(t)
  if (!m) return vazio
  return { marca: m[1].trim(), modelo: m[2].trim(), anos: m[3].replace(/\s+/g, " ").trim() }
}

function base($: cheerio.CheerioAPI, url: string, status: number, urlFinal: string, nos: Obj[], invalidos: number): DadosBase {
  return {
    url,
    status,
    urlFinal,
    erro: null,
    titulo: limpar($("title").first().text()),
    h1: limpar($("h1").first().text()),
    canonical: limpar($('link[rel="canonical"]').attr("href")),
    robots: limpar($('meta[name="robots"]').attr("content")),
    breadcrumbJsonLd: breadcrumbDoJsonLd(nos, urlFinal),
    jsonLdInvalido: invalidos,
  }
}

export function extrairProduto(html: string, url: string, status: number, urlFinal: string): DadosProduto {
  const $ = cheerio.load(html)
  const { nos, invalidos } = lerJsonLd($)
  const produto = nos.find((n) => tipos(n).includes("Product"))
  const ofertas = produto && ehObj(produto.offers) ? produto.offers : null
  const marca = produto ? (ehObj(produto.brand) ? texto(produto.brand.name) : texto(produto.brand)) : null
  const condicao = texto(produto?.itemCondition) ?? texto(ofertas?.itemCondition)
  const descricao = texto(produto?.description) ?? limpar($("#descricao-produto").text())
  const compat = compatibilidade(descricao)
  const idCategoria = /"categoria_id"\s*:\s*(\d+)/.exec(html)

  return {
    ...base($, url, status, urlFinal, nos, invalidos),
    breadcrumbPlataforma: breadcrumbDaPlataforma(html, urlFinal),
    categoriaPrincipalId: idCategoria ? Number(idCategoria[1]) : null,
    categoriasPagina: limpar($("#prod-categorias").attr("value")),
    nomeProduto: limpar($("#prod-nome").attr("value")) ?? texto(produto?.name),
    marcaSchema: marca,
    condicaoSchema: condicao ? condicao.replace(/^https?:\/\/schema\.org\//, "") : null,
    categoriaSchema: texto(produto?.category),
    compatMarca: compat.marca,
    compatModelo: compat.modelo,
    compatAnos: compat.anos,
    mencionaUsado: /\busad[oa]s?\b|\bseminov[oa]s?\b/i.test(`${texto(produto?.name) ?? ""} ${limpar($("title").first().text()) ?? ""} ${url} ${descricao ?? ""}`),
    categoriaOrigem: null,
  }
}

export function extrairCategoria(html: string, url: string, status: number, urlFinal: string): DadosCategoria & { produtos: string[] } {
  const $ = cheerio.load(html)
  const { nos, invalidos } = lerJsonLd($)
  const lista = nos.find((n) => tipos(n).includes("ItemList") && !tipos(n).includes("BreadcrumbList"))
  const produtos: string[] = []
  if (lista && Array.isArray(lista.itemListElement)) {
    for (const el of lista.itemListElement.filter(ehObj)) {
      const u = texto(el.url) ?? (ehObj(el.item) ? texto(el.item.url) ?? texto(el.item["@id"]) : texto(el.item))
      const abs = resolver(u, urlFinal)
      if (abs) produtos.push(abs)
    }
  }
  const proxima = resolver(limpar($('link[rel="next"]').attr("href")) ?? limpar($('a[rel="next"]').attr("href")), urlFinal)
  return {
    ...base($, url, status, urlFinal, nos, invalidos),
    produtosNaListagem: produtos.length,
    proximaPagina: proxima,
    produtos,
  }
}
