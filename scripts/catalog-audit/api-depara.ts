/**
 * Cruza produtos e categorias da API Magazord com a classificação (tipo, sistema, marca, modelo)
 * e gera o de/para: categoria atual -> ação -> caminho proposto Marca > Modelo > Sistema.
 * Offline: lê os arquivos gerados por `npm run audit:api`.
 *
 * Uso:
 *   npm run audit:depara -- [--dir output/catalog-audit/api] [--sitemap urls-produto.txt] [--categoria-tecnica 10095]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import type { CategoriaMagazord, ProdutoMagazord } from "./magazord"
import { aprenderDicionario, chaveModelo, classificarTexto, tokenizar, type Classificacao } from "./taxonomy"

type Acao = "PROMOVER_EXISTENTE" | "ATRIBUIR_NOVA" | "OK_ARVORE_ATUAL" | "REVISAR" | "SEM_CATEGORIA"

const DESCRICAO_ACAO: Record<Acao, string> = {
  PROMOVER_EXISTENTE: "Principal é técnica, mas o produto já tem categoria na árvore: promover essa categoria a principal",
  ATRIBUIR_NOVA: "Principal é técnica e não há outra categoria: atribuir categoria nova (caminho proposto)",
  OK_ARVORE_ATUAL: "Principal já está na árvore Marca > Modelo > Grupo (falta só a reestruturação da árvore)",
  REVISAR: "Principal fora da árvore de veículos (ex.: raiz sem filhos, marca de pneu): revisar manualmente",
  SEM_CATEGORIA: "Produto sem nenhuma categoria",
}

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

function main(): void {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      sitemap: { type: "string" },
      "categoria-tecnica": { type: "string", multiple: true },
    },
  })
  const dir = values.dir ?? join("output", "catalog-audit", "api")
  const tecnicas = new Set((values["categoria-tecnica"] ?? ["10095"]).map(Number))

  const categorias = JSON.parse(readFileSync(join(dir, "categorias.json"), "utf-8")) as CategoriaMagazord[]
  const produtos = readFileSync(join(dir, "produtos.jsonl"), "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ProdutoMagazord)
  const unicos = new Map<number, ProdutoMagazord>()
  for (const p of produtos) unicos.set(p.id, p)
  const lista = Array.from(unicos.values())
  console.log(`[depara] ${categorias.length} categorias, ${lista.length} produtos únicos (${produtos.length} linhas)`)

  // Árvore
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const filhos = new Map<number, number>()
  for (const c of categorias) if (c.pai !== null) filhos.set(c.pai, (filhos.get(c.pai) ?? 0) + 1)
  const caminho = (id: number): CategoriaMagazord[] => {
    const out: CategoriaMagazord[] = []
    let atual = porId.get(id)
    const vistos = new Set<number>()
    while (atual && !vistos.has(atual.id)) {
      vistos.add(atual.id)
      out.unshift(atual)
      atual = atual.pai !== null ? porId.get(atual.pai) : undefined
    }
    return out
  }
  const nomeCaminho = (id: number) => caminho(id).map((c) => c.nome.trim()).join(" > ") || `(id ${id} inexistente)`
  const raiz = (id: number) => caminho(id)[0]?.id ?? null
  /** Categoria "de veículo": abaixo de uma raiz com filhos e fora das técnicas. */
  const naArvore = (id: number) => {
    const r = raiz(id)
    return r !== null && !tecnicas.has(r) && !tecnicas.has(id) && (filhos.get(r) ?? 0) > 0
  }

  // Classificação pelo nome (dicionário aprendido dos nomes + slugs do sitemap, se houver)
  const slugs = values.sitemap && existsSync(values.sitemap) ? readFileSync(values.sitemap, "utf-8").split(/\r?\n/).filter(Boolean).map((u) => u.replace(/^https?:\/\/[^/]+\/+/, "")) : []
  const { modelos, familias } = aprenderDicionario([...lista.map((p) => p.nome), ...slugs])
  console.log(`[depara] dicionário: ${modelos.size} modelos, ${familias.size} famílias`)
  const classe = new Map<number, Classificacao>()
  for (const p of lista) classe.set(p.id, classificarTexto(String(p.id), p.nome, modelos, familias))

  // Raiz atual -> marca real (maioria dos produtos)
  const marcasPorRaiz = new Map<number, Map<string, number>>()
  for (const p of lista) {
    const marca = classe.get(p.id)?.marca
    if (!marca) continue
    for (const r of new Set(p.categorias.filter(naArvore).map(raiz))) {
      if (r === null) continue
      const m = marcasPorRaiz.get(r) ?? new Map<string, number>()
      m.set(marca, (m.get(marca) ?? 0) + 1)
      marcasPorRaiz.set(r, m)
    }
  }
  const linhasRaiz: (string | number | null)[][] = [["raiz_id", "raiz_nome_atual", "produtos_classificados", "marca_majoritaria", "percentual", "segunda_marca", "nome_sugerido"]]
  const resumoRaiz: { id: number; nome: string; n: number; marca: string; p: number }[] = []
  for (const [r, m] of marcasPorRaiz) {
    const ord = Array.from(m.entries()).sort((a, b) => b[1] - a[1])
    const n = ord.reduce((a, [, v]) => a + v, 0)
    const nome = porId.get(r)?.nome.trim() ?? String(r)
    resumoRaiz.push({ id: r, nome, n, marca: ord[0][0], p: ord[0][1] / n })
    linhasRaiz.push([r, nome, n, ord[0][0], pct(ord[0][1], n), ord[1] ? `${ord[1][0]} (${pct(ord[1][1], n)})` : null, titulo(ord[0][0])])
  }
  resumoRaiz.sort((a, b) => b.n - a.n)
  linhasRaiz.splice(1, linhasRaiz.length - 1, ...linhasRaiz.slice(1).sort((a, b) => Number(b[2]) - Number(a[2])))
  writeFileSync(join(dir, "raizes-marca.csv"), csv(linhasRaiz))

  // De/para por produto
  const contAcao = new Map<string, number>()
  const contAcaoAtivo = new Map<string, number>()
  const linhas: (string | number | null)[][] = [
    ["id", "codigo", "nome", "ativo", "acao", "principal_id", "principal_caminho", "promover_id", "promover_caminho", "outras_categorias", "marca", "modelo", "sistema", "tipo_peca", "anos", "caminho_proposto"],
  ]
  for (const p of lista) {
    const c = classe.get(p.id)
    const principal = p.categorias[0] ?? null
    const daArvore = p.categorias.filter(naArvore)
    const maisFunda = daArvore.sort((a, b) => caminho(b).length - caminho(a).length)[0] ?? null
    let acao: Acao
    if (principal === null) acao = "SEM_CATEGORIA"
    else if (tecnicas.has(principal) || (raiz(principal) !== null && tecnicas.has(raiz(principal) as number))) acao = maisFunda !== null ? "PROMOVER_EXISTENTE" : "ATRIBUIR_NOVA"
    else if (naArvore(principal)) acao = "OK_ARVORE_ATUAL"
    else acao = "REVISAR"
    contAcao.set(acao, (contAcao.get(acao) ?? 0) + 1)
    if (p.ativo) contAcaoAtivo.set(acao, (contAcaoAtivo.get(acao) ?? 0) + 1)

    // Modelo: prefere o nome da categoria de modelo que a loja já usa (nível 2), senão o classificado
    const catModelo = maisFunda !== null ? caminho(maisFunda)[1] : undefined
    const modelo = catModelo ? catModelo.nome.trim() : c?.modelo ? c.modelo.toUpperCase() : null
    const marca = c?.marca ? titulo(c.marca) : null
    const proposto = marca && modelo && c ? `${marca} > ${modelo} > ${c.sistema}` : null
    linhas.push([
      p.id, p.codigo, p.nome, p.ativo ? "sim" : "não", acao, principal, principal !== null ? nomeCaminho(principal) : null,
      acao === "PROMOVER_EXISTENTE" ? maisFunda : null, acao === "PROMOVER_EXISTENTE" && maisFunda !== null ? nomeCaminho(maisFunda) : null,
      p.categorias.slice(1).map(nomeCaminho).join(" | "), marca, modelo, c?.sistema ?? null, c?.tipoPeca ?? null, c?.anos ?? null, proposto,
    ])
  }
  writeFileSync(join(dir, "depara-produtos.csv"), csv(linhas))

  // Modelos da árvore atual (nível 2) x modelos classificados
  const nivel2 = categorias.filter((c) => caminho(c.id).length === 2)
  const chavesNivel2 = new Set(nivel2.map((c) => chaveModelo(tokenizar(c.nome).join(" "))))
  const modelosClassificados = new Map<string, number>()
  const nomeExibicao = new Map<string, string>()
  for (const c of classe.values()) {
    if (!c.modelo) continue
    const k = chaveModelo(c.modelo)
    modelosClassificados.set(k, (modelosClassificados.get(k) ?? 0) + 1)
    if (!nomeExibicao.has(k)) nomeExibicao.set(k, c.modelo)
  }
  const semCategoriaModelo = Array.from(modelosClassificados.entries()).filter(([k]) => !chavesNivel2.has(k)).sort((a, b) => b[1] - a[1])

  // Resumo
  const ativos = lista.filter((p) => p.ativo).length
  const principalTecnica = lista.filter((p) => p.categorias[0] !== undefined && tecnicas.has(p.categorias[0]))
  const principalTecnicaAtivos = principalTecnica.filter((p) => p.ativo).length
  const nivel3 = new Map<string, number>()
  for (const c of categorias) if (caminho(c.id).length === 3) nivel3.set(c.nome.trim(), (nivel3.get(c.nome.trim()) ?? 0) + 1)
  const md: string[] = []
  md.push("# De/para de categorias (API Magazord)", "")
  md.push(`- Produtos na API: ${fmt(lista.length)} (ativos: ${fmt(ativos)}; inativos: ${fmt(lista.length - ativos)})`)
  if (slugs.length) md.push(`- URLs de produto no sitemap: ${fmt(slugs.length)} (diferença para os ativos da API: ${fmt(ativos - slugs.length)}; aproximação, sem casar URL a URL)`)
  md.push(`- Linhas extraídas: ${fmt(produtos.length)}; repetidas removidas: ${fmt(produtos.length - lista.length)}`)
  md.push(`- Categorias: ${fmt(categorias.length)} | raízes: ${fmt(categorias.filter((c) => c.pai === null).length)} | nível 2: ${fmt(nivel2.length)}`)
  md.push(`- Principal = categoria técnica (${Array.from(tecnicas).join(", ")}): ${fmt(principalTecnica.length)} (${pct(principalTecnica.length, lista.length)}); entre ativos: ${fmt(principalTecnicaAtivos)} (${pct(principalTecnicaAtivos, ativos)})`, "")
  md.push("## Ação por produto", "", "| Ação | Todos | Ativos | O que fazer |", "|---|---|---|---|")
  for (const a of Object.keys(DESCRICAO_ACAO) as Acao[]) {
    md.push(`| ${a} | ${fmt(contAcao.get(a) ?? 0)} (${pct(contAcao.get(a) ?? 0, lista.length)}) | ${fmt(contAcaoAtivo.get(a) ?? 0)} (${pct(contAcaoAtivo.get(a) ?? 0, ativos)}) | ${DESCRICAO_ACAO[a]} |`)
  }
  md.push("", "## Raízes atuais × marca real (maioria dos produtos)", "", "| Raiz (id) | Nome atual | Produtos | Marca majoritária | % |", "|---|---|---|---|---|")
  for (const r of resumoRaiz.slice(0, 30)) md.push(`| ${r.id} | ${r.nome} | ${fmt(r.n)} | ${titulo(r.marca)} | ${pct(r.p, 1)} |`)
  md.push("", "## Nível 3 da árvore atual", "", "| Nome | Ocorrências |", "|---|---|")
  for (const [n, q] of Array.from(nivel3.entries()).sort((a, b) => b[1] - a[1])) md.push(`| ${n} | ${fmt(q)} |`)
  md.push(
    "",
    "## Modelos classificados sem categoria de mesmo nome na árvore (top 25)",
    "",
    "Parte é só grafia diferente (ex.: \"CBR 1000 RR\" × categoria \"CBR 1000 RR FIREBLADE\"): exige de/para de nomes de modelo, não necessariamente categoria nova.",
    "",
    "| Modelo (classificado) | Produtos |",
    "|---|---|",
  )
  for (const [k, n] of semCategoriaModelo.slice(0, 25)) md.push(`| ${(nomeExibicao.get(k) ?? k).toUpperCase()} | ${fmt(n)} |`)
  md.push(
    "",
    "## Limitações",
    "",
    "- Marca/modelo/sistema vêm do nome do produto (classificador heurístico); o modelo da árvore atual tem prioridade quando existe.",
    "- \"Raiz × marca\" usa a maioria dos produtos classificados sob cada raiz; confirmar as divergentes.",
    "- Paginação por offset sobre catálogo vivo: produtos alterados durante a extração podem faltar ou repetir (repetidos foram removidos).",
    "",
  )
  writeFileSync(join(dir, "resumo-depara.md"), md.join("\n"))
  console.log(`[depara] gerado em ${dir}: depara-produtos.csv, raizes-marca.csv, resumo-depara.md`)
}

try {
  main()
} catch (e) {
  console.error("[depara] Erro fatal:", e)
  process.exitCode = 1
}
