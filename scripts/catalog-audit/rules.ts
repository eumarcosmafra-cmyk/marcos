import { MARCAS_VEICULO, NOMES_HOME, TERMOS_CATEGORIA_PROMOCIONAL, TERMOS_CATEGORIA_TECNICA, TERMOS_NOME_GENERICO } from "./config"
import type { Achado, BreadcrumbItem, DadosBase, DadosCategoria, DadosProduto, Severidade, Sugestao } from "./types"

export interface Contexto {
  /** Slugs das categorias públicas (sitemap de categorias), para sugerir destino. */
  slugsCategorias: Set<string>
  profundidadeMax: number
}

export const normalizar = (s: string | null | undefined): string =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()

export const slug = (s: string): string =>
  normalizar(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const contemTermo = (nome: string, termos: string[]): string | null => {
  const n = ` ${normalizar(nome)} `
  return termos.find((t) => (t.includes("%") ? n.includes(t) : n.includes(` ${t} `))) ?? null
}

/** Normaliza URL para comparação: host minúsculo, barras duplicadas e barra final removidas. */
export function chaveUrl(u: string | null): string {
  if (!u) return ""
  try {
    const x = new URL(u)
    const caminho = x.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "")
    return `${x.host.toLowerCase()}${decodeURIComponent(caminho)}${x.search}`
  } catch (e) {
    console.error("[rules] URL inválida:", u, e)
    return u
  }
}

const achado = (regra: string, severidade: Severidade, detalhe: string): Achado => ({ regra, severidade, detalhe })

/** Remove Home (início) e a própria página (fim), sobrando só os níveis de categoria. */
export function niveisDeCategoria(bc: BreadcrumbItem[], urlPagina: string, nomePagina: string | null): BreadcrumbItem[] {
  let itens = bc.slice()
  if (itens.length && (NOMES_HOME.includes(normalizar(itens[0].nome)) || (itens[0].url && new URL(itens[0].url).pathname.replace(/\/+/g, "/") === "/"))) {
    itens = itens.slice(1)
  }
  const ultimo = itens[itens.length - 1]
  if (ultimo) {
    const mesmaUrl = ultimo.url !== null && chaveUrl(ultimo.url) === chaveUrl(urlPagina)
    // Sem URL, só considera "é o próprio produto" se o nome cobrir boa parte do nome da página
    // (evita remover uma categoria "Painel" de um produto "Painel Honda ...").
    const nUltimo = normalizar(ultimo.nome)
    const nPagina = normalizar(nomePagina)
    const mesmoNome = ultimo.url === null && nUltimo.length > 0 && nUltimo.length >= 0.6 * nPagina.length && nPagina.startsWith(nUltimo.slice(0, 25))
    if (mesmaUrl || mesmoNome) itens = itens.slice(0, -1)
  }
  return itens
}

function marcasEm(textoLivre: string): string[] {
  const n = ` ${normalizar(textoLivre).replace(/[^a-z0-9 ]+/g, " ")} `
  const achadas = MARCAS_VEICULO.filter((m) => n.includes(` ${m} `))
  // "harley davidson" já cobre "harley"
  return achadas.filter((m) => !achadas.some((o) => o !== m && o.includes(m)))
}

function regrasComuns(d: DadosBase, saida: Achado[]): void {
  if (d.erro || d.status !== 200) {
    saida.push(achado("HTTP_ERRO", "CRITICA", d.erro ?? `HTTP ${d.status}`))
    return
  }
  if (chaveUrl(d.url) !== chaveUrl(d.urlFinal)) saida.push(achado("REDIRECIONA", "MEDIA", `${d.url} -> ${d.urlFinal}`))
  if (d.robots && /noindex/i.test(d.robots)) saida.push(achado("NOINDEX", "ALTA", d.robots))
  if (!d.canonical) saida.push(achado("SEM_CANONICAL", "ALTA", "Sem <link rel=canonical>"))
  else {
    let caminhoCanonical = ""
    try {
      caminhoCanonical = new URL(d.canonical).pathname
    } catch (e) {
      console.error("[rules] canonical inválido:", d.canonical, e)
    }
    const barraDupla = /\/\//.test(caminhoCanonical)
    if (barraDupla) saida.push(achado("CANONICAL_BARRA_DUPLA", "ALTA", `Canonical aponta para URL com "//": ${d.canonical}`))
    else if (chaveUrl(d.canonical) !== chaveUrl(d.urlFinal)) saida.push(achado("CANONICAL_DIVERGENTE", "ALTA", `Canonical ${d.canonical} ≠ ${d.urlFinal}`))
  }
  if (d.jsonLdInvalido > 0) saida.push(achado("JSONLD_INVALIDO", "ALTA", `${d.jsonLdInvalido} bloco(s) JSON-LD não parseáveis`))
  if (!d.h1) saida.push(achado("SEM_H1_NO_HTML", "MEDIA", "Sem <h1> no HTML servido (renderizado só via JS?). Crawlers de IA que não executam JS não veem."))
}

function regrasDeNiveis(niveis: BreadcrumbItem[], ctx: Contexto, saida: Achado[], ehProduto: boolean): void {
  if (ehProduto && niveis.length === 0) saida.push(achado("BREADCRUMB_SEM_CATEGORIA", "ALTA", "Breadcrumb vai de Home direto ao produto"))
  if (niveis.length > ctx.profundidadeMax) saida.push(achado("PROFUNDIDADE_EXCESSIVA", "MEDIA", `${niveis.length} níveis (máx. ${ctx.profundidadeMax})`))
  niveis.forEach((n, i) => {
    const tecnico = contemTermo(n.nome, TERMOS_CATEGORIA_TECNICA)
    if (tecnico) saida.push(achado("CATEGORIA_TECNICA", "CRITICA", `"${n.nome}" (termo: ${tecnico})${n.id ? ` id=${n.id}` : ""}`))
    const promo = contemTermo(n.nome, TERMOS_CATEGORIA_PROMOCIONAL)
    if (promo && ehProduto) saida.push(achado("CATEGORIA_PROMOCIONAL_NO_BREADCRUMB", "ALTA", `"${n.nome}" (termo: ${promo})`))
    const generico = contemTermo(n.nome, TERMOS_NOME_GENERICO)
    if (generico) saida.push(achado("NOME_GENERICO", "MEDIA", `"${n.nome}"`))
    if (!n.url) saida.push(achado("CATEGORIA_SEM_URL", "ALTA", `"${n.nome}" no breadcrumb sem link (categoria não pública/inativa?)`))
    if (i > 0 && normalizar(niveis[i - 1].nome) === normalizar(n.nome)) saida.push(achado("NIVEL_REPETIDO", "MEDIA", `"${n.nome}" repetido em sequência`))
  })
}

export function avaliarProduto(d: DadosProduto, ctx: Contexto): { achados: Achado[]; sugestao: Sugestao } {
  const saida: Achado[] = []
  regrasComuns(d, saida)
  const sugestao = sugerir(d, ctx)
  if (saida.some((a) => a.regra === "HTTP_ERRO")) return { achados: saida, sugestao }

  const bc = d.breadcrumbJsonLd ?? d.breadcrumbPlataforma
  if (!d.breadcrumbJsonLd) saida.push(achado("SEM_BREADCRUMB_JSONLD", "ALTA", "Sem BreadcrumbList em JSON-LD"))
  if (!bc) {
    saida.push(achado("SEM_BREADCRUMB", "CRITICA", "Nenhuma trilha encontrada (JSON-LD nem plataforma)"))
    return { achados: saida, sugestao }
  }
  // JSON-LD não traz o ID da categoria; herda da trilha da plataforma pelo nome.
  const niveis = niveisDeCategoria(bc, d.urlFinal, d.nomeProduto).map((n) => ({
    ...n,
    id: n.id ?? d.breadcrumbPlataforma?.find((p) => normalizar(p.nome) === normalizar(n.nome))?.id ?? null,
  }))
  regrasDeNiveis(niveis, ctx, saida, true)
  if (niveis.length === 1) saida.push(achado("ARVORE_PLANA", "INFO", `Só 1 nível de categoria: "${niveis[0].nome}"`))

  if (d.breadcrumbJsonLd && d.breadcrumbPlataforma) {
    const a = niveisDeCategoria(d.breadcrumbJsonLd, d.urlFinal, d.nomeProduto).map((n) => normalizar(n.nome)).join(">")
    const b = niveisDeCategoria(d.breadcrumbPlataforma, d.urlFinal, d.nomeProduto).map((n) => normalizar(n.nome)).join(">")
    if (a !== b) saida.push(achado("JSONLD_DIVERGE_DA_PLATAFORMA", "MEDIA", `JSON-LD "${a}" ≠ plataforma "${b}"`))
  }

  const fonteMarca = [d.compatMarca, d.nomeProduto ?? d.h1 ?? d.titulo].filter(Boolean).join(" ")
  const marcasProduto = marcasEm(fonteMarca)
  const marcasTrilha = marcasEm(niveis.map((n) => n.nome).join(" "))
  if (marcasProduto.length && marcasTrilha.length && !marcasTrilha.some((m) => marcasProduto.includes(m))) {
    saida.push(achado("MARCA_DIVERGENTE", "ALTA", `Produto: ${marcasProduto.join("/")}; breadcrumb: ${marcasTrilha.join("/")}`))
  }

  const pareceUsado = /\busad[oa]s?\b/i.test(`${d.nomeProduto ?? ""} ${d.titulo ?? ""} ${d.url}`)
  if (pareceUsado && d.condicaoSchema === "NewCondition") {
    saida.push(achado("CONDICAO_DIVERGENTE", "ALTA", "Produto usado declarado como NewCondition no schema (Merchant Center/IA)"))
  }
  if (d.categoriaPrincipalId !== null && d.breadcrumbPlataforma) {
    const ids = d.breadcrumbPlataforma.map((b) => b.id).filter((x): x is number => typeof x === "number")
    if (ids.length && !ids.includes(d.categoriaPrincipalId)) {
      saida.push(achado("BREADCRUMB_FORA_DA_PRINCIPAL", "ALTA", `categoria_id=${d.categoriaPrincipalId} não está na trilha (${ids.join(",")})`))
    }
  }
  if (d.categoriaOrigem) {
    const origem = normalizar(d.categoriaOrigem)
    if (!niveis.some((n) => normalizar(n.nome) === origem)) {
      saida.push(achado("LISTADO_FORA_DA_PRINCIPAL", "INFO", `Listado em "${d.categoriaOrigem}", mas a trilha usa "${niveis.map((n) => n.nome).join(" > ") || "(nenhuma)"}"`))
    }
  }
  return { achados: saida, sugestao }
}

/** Sugestão heurística Marca > Modelo a partir do bloco de compatibilidade da descrição. */
export function sugerir(d: DadosProduto, ctx: Contexto): Sugestao {
  const marca = d.compatMarca ?? d.marcaSchema
  const modelo = d.compatModelo
  if (!marca || !modelo) return { caminhoSugerido: null, categoriasExistentes: [], candidatas: [] }
  const titulo = (s: string) => s.toLowerCase().replace(/(^|\s|-)([a-zà-ÿ])/g, (m) => m.toUpperCase())
  const sMarca = slug(marca)
  const sModelo = slug(modelo)
  const procurar = [sModelo, `${sMarca}-${sModelo}`]
  const existentes = procurar.filter((s) => ctx.slugsCategorias.has(s))
  const raizModelo = sModelo.split("-")[0]
  const candidatas = Array.from(ctx.slugsCategorias)
    .filter((s) => !existentes.includes(s) && raizModelo.length >= 3 && s.split("-").includes(raizModelo))
    .sort()
    .slice(0, 6)
  const marcaExiste = [sMarca, `ver-todos-${sMarca}`].filter((s) => ctx.slugsCategorias.has(s))
  return {
    caminhoSugerido: `Home > ${titulo(marca)} > ${titulo(modelo)}`,
    categoriasExistentes: [...marcaExiste, ...existentes],
    candidatas,
  }
}

export function avaliarCategoria(d: DadosCategoria, ctx: Contexto): Achado[] {
  const saida: Achado[] = []
  regrasComuns(d, saida)
  if (saida.some((a) => a.regra === "HTTP_ERRO")) return saida
  if (!d.breadcrumbJsonLd) saida.push(achado("SEM_BREADCRUMB_JSONLD", "ALTA", "Sem BreadcrumbList em JSON-LD"))
  const nome = d.h1 ?? d.breadcrumbJsonLd?.[d.breadcrumbJsonLd.length - 1]?.nome ?? ""
  if (d.breadcrumbJsonLd) {
    const bc = d.breadcrumbJsonLd
    const semHome = bc.length && NOMES_HOME.includes(normalizar(bc[0].nome)) ? bc.slice(1) : bc
    regrasDeNiveis(semHome, ctx, saida, false)
    if (semHome.length === 1) saida.push(achado("CATEGORIA_RAIZ", "INFO", "Categoria sem pai na trilha (Home > categoria)"))
  }
  const promo = contemTermo(nome, TERMOS_CATEGORIA_PROMOCIONAL) ?? contemTermo(d.titulo ?? "", TERMOS_CATEGORIA_PROMOCIONAL)
  if (promo) saida.push(achado("CATEGORIA_PROMOCIONAL_INDEXAVEL", "MEDIA", `"${nome || d.titulo}" indexável (termo: ${promo}). Avaliar noindex fora da campanha.`))
  if (/[^\x00-\x7F]/.test(decodeURIComponent(new URL(d.urlFinal).pathname))) saida.push(achado("URL_COM_ACENTO", "MEDIA", new URL(d.urlFinal).pathname))
  if (d.produtosNaListagem === 0) saida.push(achado("LISTAGEM_SEM_PRODUTOS", "ALTA", "ItemList vazio ou ausente na 1ª página"))
  return saida
}

/** Nomes (H1) repetidos entre categorias diferentes: canibalização / H1 genérico. */
export function marcarDuplicados(itens: { dados: DadosCategoria; achados: Achado[] }[]): void {
  const porNome = new Map<string, string[]>()
  for (const it of itens) {
    const n = normalizar(it.dados.h1)
    if (!n) continue
    porNome.set(n, [...(porNome.get(n) ?? []), it.dados.urlFinal])
  }
  for (const it of itens) {
    const urls = porNome.get(normalizar(it.dados.h1)) ?? []
    if (urls.length > 1) it.achados.push(achado("H1_DUPLICADO", "ALTA", `"${it.dados.h1}" usado em ${urls.length} categorias`))
  }
}
