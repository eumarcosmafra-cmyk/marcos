import type { ClienteHttp } from "./http"

export interface Sitemap {
  tipo: "indice" | "urlset" | "invalido"
  locs: string[]
}

export async function lerSitemap(http: ClienteHttp, url: string): Promise<Sitemap> {
  const res = await http.baixar(url)
  if (res.erro || res.status !== 200) {
    console.error(`[sitemap] Falha ao ler ${url}: ${res.erro ?? res.status}`)
    return { tipo: "invalido", locs: [] }
  }
  const locs = Array.from(res.corpo.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/g), (m) => decodificarXml(m[1].trim()))
  if (res.corpo.includes("<sitemapindex")) return { tipo: "indice", locs }
  if (res.corpo.includes("<urlset")) return { tipo: "urlset", locs }
  return { tipo: "invalido", locs: [] }
}

/** Lê o índice e devolve as URLs de todos os sitemaps filhos cujo nome casa com o filtro. */
export async function lerUrlsDoIndice(http: ClienteHttp, indice: string, filtroFilho: RegExp): Promise<{ filhos: string[]; urls: string[] }> {
  const raiz = await lerSitemap(http, indice)
  if (raiz.tipo === "urlset") return { filhos: [indice], urls: raiz.locs }
  const filhos = raiz.locs.filter((u) => filtroFilho.test(u))
  const urls: string[] = []
  for (const filho of filhos) {
    const sm = await lerSitemap(http, filho)
    urls.push(...sm.locs)
  }
  return { filhos, urls }
}

/** Amostra determinística e espalhada (não pega só o começo do sitemap). */
export function amostrar<T>(itens: T[], n: number): T[] {
  if (n <= 0 || n >= itens.length) return itens.slice()
  const passo = itens.length / n
  return Array.from({ length: n }, (_, i) => itens[Math.floor(i * passo + passo / 2)])
}

function decodificarXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}
