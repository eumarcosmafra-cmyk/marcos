/**
 * Compara duas extrações do GSC (Páginas.csv) e lista as páginas que mais perderam cliques por dia.
 * Normaliza URL (sem parâmetros, sem "//") e período (cliques/dia). Somente leitura, offline.
 *
 * Uso: npm run audit:gsc-comparar -- --antes <dir> --dias-antes 85 --depois <dir> --dias-depois 68 [--categorias categorias-publicas.txt]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR")
const pct = (a: number, b: number) => `${((a / (b || 1)) * 100).toFixed(1).replace(".", ",")}%`
const csvExcel = (linhas: (string | number)[][]) =>
  "﻿" + linhas.map((l) => l.map((v) => { const s = String(v ?? ""); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(";")).join("\r\n") + "\r\n"

function carregar(dir: string): Map<string, { c: number; i: number }> {
  const m = new Map<string, { c: number; i: number }>()
  for (const r of lerCsv(readFileSync(join(dir, "Páginas.csv"), "utf-8"), ",")) {
    let path: string
    try {
      path = decodeURIComponent(new URL(r["Páginas principais"]).pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/"
    } catch (e) {
      console.error("[comparar] URL inválida:", r["Páginas principais"], e instanceof Error ? e.message : e)
      continue
    }
    const v = m.get(path) ?? { c: 0, i: 0 }
    v.c += Number(r.Cliques) || 0
    v.i += Number(r["Impressões"]) || 0
    m.set(path, v)
  }
  return m
}

function main(): void {
  const { values } = parseArgs({ options: { antes: { type: "string" }, depois: { type: "string" }, "dias-antes": { type: "string" }, "dias-depois": { type: "string" }, categorias: { type: "string" }, saida: { type: "string" } } })
  if (!values.antes || !values.depois || !values["dias-antes"] || !values["dias-depois"]) throw new Error("Informe --antes, --depois, --dias-antes e --dias-depois")
  const da = Number(values["dias-antes"])
  const dd = Number(values["dias-depois"])
  const saida = values.saida ?? join("output", "catalog-audit", "gsc")
  const A = carregar(values.antes)
  const B = carregar(values.depois)
  const publicas = values.categorias && existsSync(values.categorias) ? new Set(readFileSync(values.categorias, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) : new Set<string>()
  const tipo = (p: string) => {
    const s = p.replace(/^\//, "")
    if (p === "/") return "Home"
    if (s.startsWith("blog")) return "Blog"
    if (s.startsWith("ver-todos-")) return "Ver todos"
    if (publicas.has(s)) return "Categoria pública (marca, modelo, tipo de peça)"
    return "Produto"
  }
  const caminhos = new Set([...A.keys(), ...B.keys()])
  const linhas = Array.from(caminhos).map((p) => {
    const a = A.get(p) ?? { c: 0, i: 0 }
    const b = B.get(p) ?? { c: 0, i: 0 }
    return { p, tipo: tipo(p), ca: a.c / da, cb: b.c / dd, ia: a.i / da, ib: b.i / dd }
  })
  const porTipo = new Map<string, { ca: number; cb: number; ia: number; ib: number; zerou: number; n: number }>()
  for (const l of linhas) {
    const v = porTipo.get(l.tipo) ?? { ca: 0, cb: 0, ia: 0, ib: 0, zerou: 0, n: 0 }
    v.ca += l.ca; v.cb += l.cb; v.ia += l.ia; v.ib += l.ib; v.n++
    if (l.ca > 0 && l.cb === 0 && l.ib === 0) v.zerou++
    porTipo.set(l.tipo, v)
  }
  const totA = linhas.reduce((s, l) => s + l.ca, 0)
  const totB = linhas.reduce((s, l) => s + l.cb, 0)
  const perdas = linhas.filter((l) => l.ca > l.cb).sort((x, y) => (y.ca - y.cb) - (x.ca - x.cb))
  const sumiram = linhas.filter((l) => l.ca > 0 && l.ib === 0)
  writeFileSync(
    join(saida, "paginas-perda-agosto.csv"),
    csvExcel([["pagina", "tipo", "cliques_dia_antes", "cliques_dia_depois", "perda_cliques_dia", "impressoes_dia_antes", "impressoes_dia_depois", "sumiu_da_busca"], ...perdas.map((l) => [l.p, l.tipo, l.ca.toFixed(2), l.cb.toFixed(2), (l.ca - l.cb).toFixed(2), l.ia.toFixed(1), l.ib.toFixed(1), l.ib === 0 ? "sim" : ""])]),
  )
  const md: string[] = []
  md.push("# Queda de agosto: antes × depois", "", `Antes: ${da} dias. Depois: ${dd} dias. Valores por dia.`, "")
  md.push(`- Cliques/dia: ${fmt(totA)} → ${fmt(totB)} (${pct(totB - totA, totA)})`)
  md.push(`- Páginas que tinham clique antes e não tiveram nenhuma impressão depois: ${fmt(sumiram.length)} (somavam ${fmt(sumiram.reduce((s, l) => s + l.ca, 0))} cliques/dia)`, "")
  md.push("| Tipo de página | Cliques/dia antes | Depois | Variação | Impressões/dia antes | Depois | Páginas que sumiram |", "|---|---|---|---|---|---|---|")
  for (const [k, v] of Array.from(porTipo.entries()).sort((a, b) => b[1].ca - a[1].ca)) md.push(`| ${k} | ${fmt(v.ca)} | ${fmt(v.cb)} | ${pct(v.cb - v.ca, v.ca)} | ${fmt(v.ia)} | ${fmt(v.ib)} | ${fmt(v.zerou)} |`)
  md.push("", "## 30 páginas que mais perderam cliques", "", "| Página | Tipo | Cliques/dia antes | Depois |", "|---|---|---|---|")
  for (const l of perdas.slice(0, 30)) md.push(`| ${l.p} | ${l.tipo} | ${l.ca.toFixed(1).replace(".", ",")} | ${l.cb.toFixed(1).replace(".", ",")} |`)
  writeFileSync(join(saida, "queda-agosto.md"), md.join("\n") + "\n")
  console.log(md.slice(0, 16).join("\n"))
}

try {
  main()
} catch (e) {
  console.error("[comparar] Erro fatal:", e)
  process.exitCode = 1
}
