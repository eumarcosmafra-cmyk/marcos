import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { extrairCategoria, extrairProduto } from "./extract"
import { ClienteHttp, emLotes } from "./http"
import { escreverRelatorio } from "./report"
import { Robots } from "./robots"
import { avaliarCategoria, avaliarProduto, marcarDuplicados, type Contexto } from "./rules"
import { amostrar, lerUrlsDoIndice } from "./sitemap"
import type { DadosProduto, ResultadoCategoria, ResultadoProduto } from "./types"

const AJUDA = `
Auditoria de catálogo (categorias, produtos, breadcrumbs) via HTML público. Somente leitura.

Uso:
  npm run audit:catalogo -- --site https://www.loja.com.br [opções]

Fontes de produtos (combináveis):
  --url <url>            Produto específico (repetível)
  --categoria <url>      Percorre a listagem da categoria (ItemList + paginação rel=next) (repetível)
  --produtos             Amostra dos sitemaps de produto
  --amostra <n>          Tamanho da amostra para --produtos (padrão 300)
  --categorias           Audita todas as URLs do sitemap de categorias

Outras:
  --max-paginas <n>      Páginas por categoria em --categoria (padrão 10)
  --delay <ms>           Intervalo mínimo entre requisições (padrão 1000)
  --concorrencia <n>     Conexões simultâneas (padrão 2)
  --profundidade-max <n> Níveis de categoria antes de alertar (padrão 4)
  --salvar-html <n>      Salva o HTML das N primeiras páginas para depuração (padrão 0)
  --user-agent <ua>      User-Agent (padrão: MPL-CatalogAudit)
  --saida <dir>          Pasta do relatório (padrão output/catalog-audit/<host>-<data>)
`

const TOKEN_AGENTE = "MPL-CatalogAudit"

function numero(v: string | undefined, padrao: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : padrao
}

/** Requisita sempre com barra simples (como o link interno), mesmo que o sitemap traga "//". */
function urlDeRequisicao(u: string): string {
  const x = new URL(u)
  x.pathname = x.pathname.replace(/\/{2,}/g, "/")
  return x.toString()
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      site: { type: "string" },
      url: { type: "string", multiple: true },
      categoria: { type: "string", multiple: true },
      produtos: { type: "boolean", default: false },
      categorias: { type: "boolean", default: false },
      amostra: { type: "string" },
      "max-paginas": { type: "string" },
      delay: { type: "string" },
      concorrencia: { type: "string" },
      "profundidade-max": { type: "string" },
      "salvar-html": { type: "string" },
      "user-agent": { type: "string" },
      saida: { type: "string" },
      ajuda: { type: "boolean", default: false },
    },
  })

  const urlsDiretas = values.url ?? []
  const categoriasListagem = values.categoria ?? []
  if (values.ajuda || (!urlsDiretas.length && !categoriasListagem.length && !values.produtos && !values.categorias)) {
    console.log(AJUDA)
    return
  }
  const siteBruto = values.site ?? urlsDiretas[0] ?? categoriasListagem[0]
  if (!siteBruto) throw new Error("Informe --site")
  const site = new URL(siteBruto).origin
  const inicio = new Date()
  const carimbo = inicio.toISOString().slice(0, 16).replace(/[-:T]/g, "")
  const saida = values.saida ?? join("output", "catalog-audit", `${new URL(site).host}-${carimbo}`)
  const salvarHtml = numero(values["salvar-html"], 0)
  let htmlSalvos = 0

  const http = new ClienteHttp({
    userAgent: values["user-agent"] ?? `Mozilla/5.0 (compatible; ${TOKEN_AGENTE}/0.1)`,
    timeoutMs: 30_000,
    delayMs: numero(values.delay, 1000),
    maxTentativas: 4,
  })
  const concorrencia = numero(values.concorrencia, 2)

  // robots.txt
  const resRobots = await http.baixar(`${site}/robots.txt`)
  const robots = resRobots.status === 200 ? Robots.interpretar(resRobots.corpo, TOKEN_AGENTE) : Robots.liberarTudo()
  if (resRobots.status !== 200) console.error(`[run] robots.txt indisponível (${resRobots.erro ?? resRobots.status}); seguindo sem restrições`)

  // categorias públicas (para sugestões e para --categorias)
  const indice = `${site}/sitemap.xml`
  const { urls: urlsCategorias } = await lerUrlsDoIndice(http, indice, /categor/i)
  const ctx: Contexto = {
    slugsCategorias: new Set(urlsCategorias.map((u) => decodeURIComponent(new URL(u).pathname).replace(/^\/+|\/+$/g, "").toLowerCase())),
    profundidadeMax: numero(values["profundidade-max"], 4),
  }
  console.log(`[run] ${ctx.slugsCategorias.size} categorias no sitemap`)

  // monta a fila de produtos
  const fila: { url: string; origem: string | null }[] = urlsDiretas.map((u) => ({ url: u, origem: null }))
  const modo: string[] = []
  if (urlsDiretas.length) modo.push(`--url (${urlsDiretas.length})`)

  for (const cat of categoriasListagem) {
    modo.push(`--categoria ${cat}`)
    let pagina: string | null = cat
    let nomeCategoria: string | null = null
    for (let i = 0; pagina && i < numero(values["max-paginas"], 10); i++) {
      const res = await http.baixar(pagina)
      if (res.status !== 200) {
        console.error(`[run] listagem ${pagina} -> ${res.erro ?? res.status}`)
        break
      }
      const dados = extrairCategoria(res.corpo, pagina, res.status, res.urlFinal)
      nomeCategoria = nomeCategoria ?? dados.h1 ?? dados.breadcrumbJsonLd?.at(-1)?.nome ?? null
      for (const p of dados.produtos) fila.push({ url: p, origem: nomeCategoria })
      console.log(`[run] ${pagina}: ${dados.produtos.length} produtos`)
      pagina = dados.proximaPagina
    }
  }

  let urlsNoSitemapProduto: number | null = null
  let urlsSitemapComBarraDupla: number | null = null
  if (values.produtos) {
    const { filhos, urls } = await lerUrlsDoIndice(http, indice, /produto|product/i)
    urlsNoSitemapProduto = urls.length
    urlsSitemapComBarraDupla = urls.filter((u) => /^https?:\/\/[^/]+\/\//.test(u)).length
    const n = numero(values.amostra, 300)
    const amostra = amostrar(urls, n)
    modo.push(`--produtos amostra ${amostra.length}/${urls.length} de ${filhos.length} sitemaps`)
    for (const u of amostra) fila.push({ url: u, origem: null })
  }

  // dedup + robots
  const vistos = new Set<string>()
  const bloqueadas: string[] = []
  const filaFinal = fila
    .map((f) => ({ ...f, url: urlDeRequisicao(f.url) }))
    .filter((f) => {
      if (vistos.has(f.url)) return false
      vistos.add(f.url)
      if (!robots.permitido(f.url)) {
        bloqueadas.push(f.url)
        return false
      }
      return true
    })

  console.log(`[run] auditando ${filaFinal.length} produtos (delay ${values.delay ?? 1000}ms, concorrência ${concorrencia})`)
  let feitos = 0
  const produtos: ResultadoProduto[] = await emLotes(filaFinal, concorrencia, async (f) => {
    const res = await http.baixar(f.url)
    let dados: DadosProduto
    if (res.erro || res.status !== 200) {
      dados = extrairProduto("", f.url, res.status, res.urlFinal)
      dados.erro = res.erro
    } else {
      dados = extrairProduto(res.corpo, f.url, res.status, res.urlFinal)
      if (htmlSalvos < salvarHtml) {
        mkdirSync(join(saida, "html"), { recursive: true })
        writeFileSync(join(saida, "html", `produto-${++htmlSalvos}.html`), res.corpo)
      }
    }
    dados.categoriaOrigem = f.origem
    const { achados, sugestao } = avaliarProduto(dados, ctx)
    if (++feitos % 25 === 0) console.log(`[run] produtos: ${feitos}/${filaFinal.length}`)
    return { dados, achados, sugestao }
  })

  let categorias: ResultadoCategoria[] = []
  if (values.categorias) {
    modo.push(`--categorias (${urlsCategorias.length})`)
    const filaCat = Array.from(new Set(urlsCategorias.map(urlDeRequisicao))).filter((u) => robots.permitido(u))
    console.log(`[run] auditando ${filaCat.length} categorias`)
    feitos = 0
    categorias = await emLotes(filaCat, concorrencia, async (u) => {
      const res = await http.baixar(u)
      const dados = extrairCategoria(res.status === 200 ? res.corpo : "", u, res.status, res.urlFinal)
      dados.erro = res.erro
      if (++feitos % 25 === 0) console.log(`[run] categorias: ${feitos}/${filaCat.length}`)
      return { dados, achados: avaliarCategoria(dados, ctx) }
    })
    marcarDuplicados(categorias)
  }

  const gerados = escreverRelatorio(saida, produtos, categorias, {
    site,
    modo,
    inicio,
    fim: new Date(),
    requisicoes: http.requisicoes,
    urlsNoSitemapProduto,
    urlsSitemapComBarraDupla,
    bloqueadasRobots: bloqueadas,
  })
  console.log(`[run] relatório em ${saida}: ${gerados.join(", ")}`)
}

main().catch((e) => {
  console.error("[run] Erro fatal:", e)
  process.exitCode = 1
})
