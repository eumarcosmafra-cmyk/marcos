/**
 * Extrai categorias e produtos da API Magazord para JSON/JSONL locais. Somente leitura.
 * Retomável: grava checkpoint por página; rodar de novo continua de onde parou.
 *
 * Uso:
 *   npm run audit:api -- --base https://<loja>.painel.magazord.com.br/api [--intervalo 1000] [--saida dir] [--so-categorias]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { ClienteMagazord, enxugarProduto, type CategoriaMagazord } from "./magazord"

interface Checkpoint {
  ultimaPagina: number
  totalPaginas: number
  totalApi: number
  inicio: string
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      base: { type: "string" },
      intervalo: { type: "string" },
      saida: { type: "string" },
      "so-categorias": { type: "boolean", default: false },
    },
  })
  const base = values.base ?? process.env.MAGAZORD_BASE_URL
  if (!base) throw new Error("Informe --base (ex.: https://loja.painel.magazord.com.br/api) ou MAGAZORD_BASE_URL")
  const intervalo = Number(values.intervalo ?? 1000)
  const saida = values.saida ?? join("output", "catalog-audit", "api")
  mkdirSync(saida, { recursive: true })
  const api = new ClienteMagazord(base, Number.isFinite(intervalo) && intervalo >= 500 ? intervalo : 1000)
  console.log(`[api] ${base} | 1 requisição a cada ${intervalo}ms`)

  // Categorias (poucas páginas): sempre baixa de novo
  const categorias: CategoriaMagazord[] = []
  for (let page = 1; ; page++) {
    const p = await api.pagina<CategoriaMagazord>("categoria", { limit: 100, page, order: "id", orderDirection: "asc" })
    categorias.push(...p.items)
    if (!p.has_more || page >= p.total_pages) break
  }
  writeFileSync(join(saida, "categorias.json"), JSON.stringify(categorias))
  console.log(`[api] ${categorias.length} categorias`)
  if (values["so-categorias"]) return

  // Produtos: ordenados por id crescente (novos cadastros entram no fim e não deslocam páginas já lidas)
  const arquivo = join(saida, "produtos.jsonl")
  const arqCheckpoint = join(saida, "produtos.checkpoint.json")
  let cp: Checkpoint | null = null
  if (existsSync(arqCheckpoint)) {
    try {
      cp = JSON.parse(readFileSync(arqCheckpoint, "utf-8")) as Checkpoint
      console.log(`[api] retomando da página ${cp.ultimaPagina + 1}/${cp.totalPaginas}`)
    } catch (e) {
      console.error("[api] checkpoint ilegível, recomeçando:", e)
      cp = null
    }
  }
  if (!cp && existsSync(arquivo)) writeFileSync(arquivo, "")

  let page = (cp?.ultimaPagina ?? 0) + 1
  const inicio = Date.now()
  for (;;) {
    const p = await api.pagina<Record<string, unknown>>("produto", { limit: 100, page, order: "id", orderDirection: "asc" })
    if (p.items.length) appendFileSync(arquivo, p.items.map((it) => JSON.stringify(enxugarProduto(it))).join("\n") + "\n")
    cp = { ultimaPagina: page, totalPaginas: p.total_pages, totalApi: p.total, inicio: cp?.inicio ?? new Date(inicio).toISOString() }
    writeFileSync(arqCheckpoint, JSON.stringify(cp))
    if (page % 100 === 0 || !p.has_more) {
      const min = (Date.now() - inicio) / 60000
      console.log(`[api] produtos: página ${page}/${p.total_pages} (${min.toFixed(1)} min, ${api.requisicoes} requisições)`)
    }
    if (!p.has_more || page >= p.total_pages) break
    page++
  }
  console.log(`[api] concluído: ${cp?.totalApi} produtos na API, arquivo ${arquivo}`)
}

main().catch((e) => {
  console.error("[api] Erro fatal:", e)
  process.exitCode = 1
})
