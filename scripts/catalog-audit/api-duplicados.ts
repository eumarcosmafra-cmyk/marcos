/**
 * Lista de produtos duplicados para análise caso a caso (somente leitura, offline).
 * Padrão encontrado: cópia com código sem zero à esquerda ("79278CH"), só na categoria técnica
 * (Mercado Livre), sem data de lançamento, e um original ("079278CH") na árvore de categorias.
 *
 * Uso: npm run audit:duplicados -- [--marca dayun] [--dir output/catalog-audit/api]
 * Saída: duplicados.csv (catálogo inteiro) ou piloto/<marca>/duplicados.csv
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import type { CategoriaMagazord, ProdutoMagazord } from "./magazord"
import { tokenizar } from "./taxonomy"

const CATEGORIA_TECNICA = 10095

function csvExcel(linhas: (string | number | null)[][]): string {
  const cel = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n") + "\r\n"
}
const fmt = (n: number) => n.toLocaleString("pt-BR")
const data = (s: string | null) => (s ? s.slice(0, 10) : "")
/** Palavras do nome sem números soltos e sem o sufixo "-NNN" da cópia. */
const palavras = (nome: string) => new Set(tokenizar(nome.replace(/-\d+\s*$/, "")).filter((t) => !/^\d+$/.test(t) && t.length > 1))

function main(): void {
  const { values } = parseArgs({ options: { marca: { type: "string" }, dir: { type: "string" } } })
  const dir = values.dir ?? join("output", "catalog-audit", "api")
  const categorias = JSON.parse(readFileSync(join(dir, "categorias.json"), "utf-8")) as CategoriaMagazord[]
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const caminho = (id: number) => {
    const out: string[] = []
    let a = porId.get(id)
    const vistos = new Set<number>()
    while (a && !vistos.has(a.id)) {
      vistos.add(a.id)
      out.unshift(a.nome.trim())
      a = a.pai !== null ? porId.get(a.pai) : undefined
    }
    return out.join(" > ") || `(id ${id})`
  }
  const marcas = new Map((JSON.parse(readFileSync(join(dir, "marcas.json"), "utf-8")) as { id: number; nome: string }[]).map((m) => [m.id, m.nome.trim()]))
  const produtos = new Map<number, ProdutoMagazord>()
  for (const l of readFileSync(join(dir, "produtos.jsonl"), "utf-8").split("\n")) if (l) {
    const p = JSON.parse(l) as ProdutoMagazord
    produtos.set(p.id, p)
  }

  const chave = (c: string) => {
    const m = /^0*(\d+)([A-Z]*)$/.exec((c ?? "").trim())
    return m ? m[1] + m[2] : null
  }
  const porCodigo = new Map<string, ProdutoMagazord[]>()
  for (const p of produtos.values()) {
    const k = chave(p.codigo)
    if (k) porCodigo.set(k, [...(porCodigo.get(k) ?? []), p])
  }

  const filtroMarca = values.marca ? tokenizar(values.marca).join(" ") : null
  const linhas: (string | number | null)[][] = [
    [
      "par", "marca", "situacao", "sugestao", "semelhanca_nome",
      "copia_id", "copia_codigo", "copia_nome", "copia_ativo", "copia_categorias", "copia_lancamento", "copia_atualizacao", "copia_derivacoes",
      "original_id", "original_codigo", "original_nome", "original_ativo", "original_categoria_principal", "original_lancamento", "original_atualizacao", "original_derivacoes",
      "conferir_no_admin",
    ],
  ]
  const cont = new Map<string, number>()
  let par = 0
  for (const copia of produtos.values()) {
    if (copia.categorias[0] !== CATEGORIA_TECNICA) continue
    const k = chave(copia.codigo)
    if (!k) continue
    const original = (porCodigo.get(k) ?? []).find((q) => q.id !== copia.id && q.categorias[0] !== CATEGORIA_TECNICA)
    if (!original) continue
    const marca = marcas.get(original.marca ?? -1) ?? marcas.get(copia.marca ?? -1) ?? ""
    if (filtroMarca && tokenizar(marca).join(" ") !== filtroMarca) continue

    const a = palavras(copia.nome)
    const b = palavras(original.nome)
    const comum = Array.from(a).filter((x) => b.has(x)).length
    const sem = a.size ? comum / a.size : 0
    let situacao: string
    let sugestao: string
    if (sem < 0.5) {
      situacao = "NOMES_DIFERENTES"
      sugestao = "Mesmo código, peças possivelmente diferentes: conferir antes de qualquer ação (pode não ser duplicado)"
    } else if (copia.ativo && original.ativo) {
      situacao = "AMBOS_ATIVOS"
      sugestao = "Mesma peça anunciada duas vezes: manter o original (na árvore, nome completo) e desativar a cópia, se não houver anúncio ou venda ligada a ela"
    } else if (copia.ativo && !original.ativo) {
      situacao = "SO_COPIA_ATIVA"
      sugestao = "Original inativo: decidir qual fica; se a cópia ficar, recategorizar e completar o nome com marca/modelo"
    } else if (!copia.ativo && original.ativo) {
      situacao = "SO_ORIGINAL_ATIVO"
      sugestao = "Cópia já inativa: nenhuma ação de catálogo; avaliar exclusão da cópia"
    } else {
      situacao = "AMBOS_INATIVOS"
      sugestao = "Nenhum ativo: sem impacto no site"
    }
    cont.set(situacao, (cont.get(situacao) ?? 0) + 1)
    linhas.push([
      ++par, marca, situacao, sugestao, `${Math.round(sem * 100)}%`,
      copia.id, copia.codigo, copia.nome, copia.ativo ? "sim" : "não", copia.categorias.map(caminho).join(" | "), data(copia.dataLancamento), data(copia.dataAtualizacao), copia.derivacoes.map((d) => d.codigo).join(","),
      original.id, original.codigo, original.nome, original.ativo ? "sim" : "não", original.categorias[0] !== undefined ? caminho(original.categorias[0]) : "", data(original.dataLancamento), data(original.dataAtualizacao), original.derivacoes.map((d) => d.codigo).join(","),
      "Estoque e preço de cada um; anúncio no Mercado Livre vinculado à cópia; pedidos recentes",
    ])
  }
  const saida = filtroMarca ? join("output", "catalog-audit", "piloto", filtroMarca.replace(/\s+/g, "-")) : dir
  mkdirSync(saida, { recursive: true })
  writeFileSync(join(saida, "duplicados.csv"), csvExcel(linhas))
  console.log(`[duplicados] ${fmt(par)} pares${filtroMarca ? ` (${values.marca})` : ""} -> ${join(saida, "duplicados.csv")}`)
  for (const [s, n] of Array.from(cont.entries()).sort((x, y) => y[1] - x[1])) console.log(`  ${s}: ${fmt(n)}`)
}

try {
  main()
} catch (e) {
  console.error("[duplicados] Erro fatal:", e)
  process.exitCode = 1
}
