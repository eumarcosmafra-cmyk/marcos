/**
 * Extrai dados do Search Console pela API (somente leitura) e grava no formato da exportação da interface
 * (Consultas.csv / Páginas.csv) e uma tabela consulta × página.
 *
 * Autenticação: segredo de rede (conta de serviço) injeta o token; o script não envia credencial.
 * A API devolve no máximo 50 mil linhas por consulta: o período é dividido em blocos mensais e somado.
 *
 * Uso: npm run audit:gsc-extrair -- --site https://www.loja.com.br/ --inicio 2026-05-08 --fim 2026-11-07 [--saida dir]
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { Limitador } from "./http"

interface Linha { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function blocosMensais(inicio: string, fim: string): [string, string][] {
  const out: [string, string][] = []
  let a = new Date(`${inicio}T00:00:00Z`)
  const f = new Date(`${fim}T00:00:00Z`)
  while (a <= f) {
    const b = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0))
    const fimBloco = b < f ? b : f
    out.push([a.toISOString().slice(0, 10), fimBloco.toISOString().slice(0, 10)])
    a = new Date(fimBloco.getTime() + 86400000)
  }
  return out
}

/**
 * Usa o endpoint de lote (batch) da API: o caminho com a URL da propriedade vai no corpo, não na URL.
 * Motivo: proxies que normalizam "%2F" no caminho quebram a rota sites/{siteUrl}/searchAnalytics/query (404).
 */
async function consultar(site: string, corpo: Record<string, unknown>, limitador: Limitador): Promise<Linha[]> {
  const caminho = `/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`
  const fronteira = "lote_gsc"
  const lote = `--${fronteira}\r\nContent-Type: application/http\r\nContent-ID: <q1>\r\n\r\nPOST ${caminho} HTTP/1.1\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(corpo)}\r\n--${fronteira}--\r\n`
  for (let t = 1; t <= 5; t++) {
    await limitador.aguardar()
    try {
      const res = await fetch("https://searchconsole.googleapis.com/batch", {
        method: "POST",
        headers: { "Content-Type": `multipart/mixed; boundary=${fronteira}` },
        body: lote,
        signal: AbortSignal.timeout(180_000),
      })
      const texto = await res.text()
      const status = Number(/HTTP\/1\.1 (\d{3})/.exec(texto)?.[1] ?? res.status)
      if (status === 429 || status >= 500) {
        console.error(`[gsc-extrair] HTTP ${status}; nova tentativa (${t}/5)`)
        await dormir(5000 * t)
        continue
      }
      const ini = texto.indexOf("{")
      const fim = texto.lastIndexOf("}")
      if (ini < 0 || fim < ini) throw new Error(`Resposta sem JSON (HTTP ${status}): ${texto.slice(0, 200)}`)
      const j = JSON.parse(texto.slice(ini, fim + 1)) as { rows?: Linha[]; error?: { message?: string } }
      if (status !== 200) throw new Error(`HTTP ${status}: ${j.error?.message ?? "erro"}`)
      return j.rows ?? []
    } catch (e) {
      console.error(`[gsc-extrair] falha (${t}/5):`, e instanceof Error ? e.message : e)
      if (t === 5) throw e
      await dormir(5000 * t)
    }
  }
  return []
}

/** Pagina (25 mil por chamada) até acabar ou chegar ao teto da API. */
async function tudo(site: string, inicio: string, fim: string, dimensions: string[], limitador: Limitador): Promise<{ linhas: Linha[]; noTeto: boolean }> {
  const linhas: Linha[] = []
  for (let startRow = 0; ; startRow += 25000) {
    const r = await consultar(site, { startDate: inicio, endDate: fim, dimensions, type: "web", rowLimit: 25000, startRow, dataState: "final" }, limitador)
    linhas.push(...r)
    if (r.length < 25000) return { linhas, noTeto: false }
    if (linhas.length >= 50000) return { linhas, noTeto: true }
  }
}

function agregar(blocos: Linha[][], nDim: number): Map<string, { keys: string[]; c: number; i: number; posxi: number }> {
  const m = new Map<string, { keys: string[]; c: number; i: number; posxi: number }>()
  for (const linhas of blocos) for (const l of linhas) {
    const k = l.keys.slice(0, nDim).join("\u0001")
    const v = m.get(k) ?? { keys: l.keys, c: 0, i: 0, posxi: 0 }
    v.c += l.clicks; v.i += l.impressions; v.posxi += l.position * l.impressions
    m.set(k, v)
  }
  return m
}

const csvVirgula = (linhas: (string | number)[][]) =>
  linhas.map((l) => l.map((v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(",")).join("\n") + "\n"

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { site: { type: "string" }, inicio: { type: "string" }, fim: { type: "string" }, saida: { type: "string" } } })
  if (!values.site || !values.inicio || !values.fim) throw new Error("Informe --site, --inicio e --fim (AAAA-MM-DD)")
  const saida = values.saida ?? join("output", "catalog-audit", "gsc-api")
  mkdirSync(saida, { recursive: true })
  const limitador = new Limitador(1000)
  const blocos = blocosMensais(values.inicio, values.fim)
  const avisos: string[] = []

  const res: Record<string, Linha[][]> = { query: [], page: [], "query,page": [] }
  for (const [a, b] of blocos) {
    for (const dims of [["query"], ["page"], ["query", "page"]]) {
      const { linhas, noTeto } = await tudo(values.site, a, b, dims, limitador)
      res[dims.join(",")].push(linhas)
      if (noTeto) avisos.push(`${a}..${b} ${dims.join("+")}: chegou ao teto de 50 mil linhas`)
      console.log(`[gsc-extrair] ${a}..${b} ${dims.join("+")}: ${linhas.length} linhas`)
    }
  }
  const linhaUi = (v: { keys: string[]; c: number; i: number; posxi: number }) => [v.c, v.i, v.i ? `${((v.c / v.i) * 100).toFixed(2)}%` : "0%", v.i ? Number((v.posxi / v.i).toFixed(2)) : 0]
  const q = Array.from(agregar(res.query, 1).values()).sort((x, y) => y.c - x.c || y.i - x.i)
  const p = Array.from(agregar(res.page, 1).values()).sort((x, y) => y.c - x.c || y.i - x.i)
  const qp = Array.from(agregar(res["query,page"], 2).values()).sort((x, y) => y.c - x.c || y.i - x.i)
  writeFileSync(join(saida, "Consultas.csv"), csvVirgula([["Top consultas", "Cliques", "Impressões", "CTR", "Posição"], ...q.map((v) => [v.keys[0], ...linhaUi(v)])]))
  writeFileSync(join(saida, "Páginas.csv"), csvVirgula([["Páginas principais", "Cliques", "Impressões", "CTR", "Posição"], ...p.map((v) => [v.keys[0], ...linhaUi(v)])]))
  writeFileSync(join(saida, "consulta-pagina.csv"), csvVirgula([["Consulta", "Página", "Cliques", "Impressões", "CTR", "Posição"], ...qp.map((v) => [v.keys[0], v.keys[1], ...linhaUi(v)])]))
  const soma = (xs: { c: number; i: number }[]) => xs.reduce((a, v) => ({ c: a.c + v.c, i: a.i + v.i }), { c: 0, i: 0 })
  const sp = soma(p), sq = soma(q), sqp = soma(qp)
  const info = [
    `Período: ${values.inicio} a ${values.fim} (${blocos.length} blocos mensais), pesquisa na Web, dados finais`,
    `Páginas: ${p.length} | cliques ${sp.c} | impressões ${sp.i}`,
    `Consultas: ${q.length} | cliques ${sq.c} (${((sq.c / (sp.c || 1)) * 100).toFixed(1)}% dos cliques por página; o resto são consultas anonimizadas pelo Google)`,
    `Consulta × página: ${qp.length} | cliques ${sqp.c}`,
    ...avisos.map((a) => `AVISO: ${a}`),
  ]
  writeFileSync(join(saida, "extracao.txt"), info.join("\n") + "\n")
  console.log(info.join("\n"))
}

main().catch((e) => {
  console.error("[gsc-extrair] Erro fatal:", e)
  process.exitCode = 1
})
