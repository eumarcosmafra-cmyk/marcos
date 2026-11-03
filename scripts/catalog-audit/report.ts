import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { niveisDeCategoria } from "./rules"
import { ORDEM_SEVERIDADE, type Achado, type BreadcrumbItem, type ResultadoCategoria, type ResultadoProduto, type Severidade } from "./types"

const SEP = ";"

function csv(linhas: (string | number | null)[][]): string {
  const celula = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM para o Excel pt-BR abrir com acentuação correta
  return "﻿" + linhas.map((l) => l.map(celula).join(SEP)).join("\r\n") + "\r\n"
}

const trilha = (bc: BreadcrumbItem[] | null) => (bc ? bc.map((b) => b.nome).join(" > ") : null)

function severidadeMax(achados: Achado[]): Severidade | null {
  return achados.reduce<Severidade | null>((max, a) => (max === null || ORDEM_SEVERIDADE[a.severidade] > ORDEM_SEVERIDADE[max] ? a.severidade : max), null)
}

export interface Meta {
  site: string
  modo: string[]
  inicio: Date
  fim: Date
  requisicoes: number
  urlsNoSitemapProduto: number | null
  urlsSitemapComBarraDupla: number | null
  bloqueadasRobots: string[]
}

export function escreverRelatorio(dir: string, produtos: ResultadoProduto[], categorias: ResultadoCategoria[], meta: Meta): string[] {
  mkdirSync(dir, { recursive: true })
  const gerados: string[] = []

  if (produtos.length) {
    const linhas: (string | number | null)[][] = [
      [
        "url", "status", "canonical", "titulo", "breadcrumb_jsonld", "breadcrumb_plataforma", "categoria_principal_id",
        "categorias_pagina", "categoria_origem", "marca_schema", "condicao_schema", "compat_marca", "compat_modelo", "compat_anos",
        "caminho_sugerido", "categorias_existentes", "categorias_candidatas", "severidade_max", "regras", "detalhes",
      ],
    ]
    for (const { dados: d, achados, sugestao: s } of produtos) {
      linhas.push([
        d.urlFinal, d.status, d.canonical, d.titulo, trilha(d.breadcrumbJsonLd), trilha(d.breadcrumbPlataforma), d.categoriaPrincipalId,
        d.categoriasPagina, d.categoriaOrigem, d.marcaSchema, d.condicaoSchema, d.compatMarca, d.compatModelo, d.compatAnos,
        s.caminhoSugerido, s.categoriasExistentes.join(" | "), s.candidatas.join(" | "), severidadeMax(achados),
        achados.map((a) => a.regra).join(" | "), achados.map((a) => `${a.regra}: ${a.detalhe}`).join(" || "),
      ])
    }
    writeFileSync(join(dir, "produtos.csv"), csv(linhas))
    gerados.push("produtos.csv")

    writeFileSync(join(dir, "arvore-observada.csv"), csv(arvoreObservada(produtos)))
    gerados.push("arvore-observada.csv")
  }

  if (categorias.length) {
    const linhas: (string | number | null)[][] = [["url", "status", "h1", "titulo", "canonical", "breadcrumb_jsonld", "produtos_1a_pagina", "severidade_max", "regras", "detalhes"]]
    for (const { dados: d, achados } of categorias) {
      linhas.push([
        d.urlFinal, d.status, d.h1, d.titulo, d.canonical, trilha(d.breadcrumbJsonLd), d.produtosNaListagem, severidadeMax(achados),
        achados.map((a) => a.regra).join(" | "), achados.map((a) => `${a.regra}: ${a.detalhe}`).join(" || "),
      ])
    }
    writeFileSync(join(dir, "categorias.csv"), csv(linhas))
    gerados.push("categorias.csv")
  }

  writeFileSync(join(dir, "resumo.md"), resumo(produtos, categorias, meta))
  gerados.push("resumo.md")
  return gerados
}

/** Árvore como o Google vê: caminho de categorias da trilha de cada produto amostrado. */
function arvoreObservada(produtos: ResultadoProduto[]): (string | number | null)[][] {
  const contagem = new Map<string, { n: number; urlCategoria: string | null; idCategoria: number | null; exemplo: string }>()
  for (const { dados: d } of produtos) {
    const bc = d.breadcrumbJsonLd ?? d.breadcrumbPlataforma
    if (!bc) continue
    const niveis = niveisDeCategoria(bc, d.urlFinal, d.nomeProduto)
    const caminho = niveis.map((n) => n.nome).join(" > ") || "(sem categoria)"
    const ultimo = niveis[niveis.length - 1]
    const idPlataforma = d.breadcrumbPlataforma?.find((b) => b.nome === ultimo?.nome)?.id ?? null
    const atual = contagem.get(caminho) ?? { n: 0, urlCategoria: ultimo?.url ?? null, idCategoria: idPlataforma, exemplo: d.urlFinal }
    atual.n++
    contagem.set(caminho, atual)
  }
  const total = produtos.filter((p) => p.dados.status === 200).length || 1
  const linhas: (string | number | null)[][] = [["caminho_categoria", "produtos_na_amostra", "percentual_amostra", "url_categoria", "id_categoria", "exemplo_produto"]]
  for (const [caminho, v] of Array.from(contagem.entries()).sort((a, b) => b[1].n - a[1].n)) {
    linhas.push([caminho, v.n, `${((v.n / total) * 100).toFixed(1).replace(".", ",")}%`, v.urlCategoria, v.idCategoria, v.exemplo])
  }
  return linhas
}

function tabelaRegras(itens: { achados: Achado[]; url: string }[]): string {
  const porRegra = new Map<string, { severidade: Severidade; n: number; exemplos: string[] }>()
  for (const it of itens) {
    for (const regra of new Set(it.achados.map((a) => a.regra))) {
      const a = it.achados.find((x) => x.regra === regra)
      if (!a) continue
      const atual = porRegra.get(regra) ?? { severidade: a.severidade, n: 0, exemplos: [] }
      atual.n++
      if (atual.exemplos.length < 3) atual.exemplos.push(it.url)
      porRegra.set(regra, atual)
    }
  }
  const linhas = Array.from(porRegra.entries()).sort((a, b) => ORDEM_SEVERIDADE[b[1].severidade] - ORDEM_SEVERIDADE[a[1].severidade] || b[1].n - a[1].n)
  if (!linhas.length) return "_Nenhum achado._\n"
  const total = itens.length
  return (
    "| Regra | Severidade | Páginas | % | Exemplo |\n|---|---|---|---|---|\n" +
    linhas.map(([r, v]) => `| ${r} | ${v.severidade} | ${v.n} | ${((v.n / total) * 100).toFixed(1).replace(".", ",")}% | ${v.exemplos[0]} |`).join("\n") +
    "\n"
  )
}

function resumo(produtos: ResultadoProduto[], categorias: ResultadoCategoria[], meta: Meta): string {
  const linhas: string[] = []
  linhas.push(`# Auditoria de catálogo: ${meta.site}`, "")
  linhas.push(`- Execução: ${meta.inicio.toISOString()} → ${meta.fim.toISOString()}`)
  linhas.push(`- Modo: ${meta.modo.join(", ")}`)
  linhas.push(`- Requisições HTTP: ${meta.requisicoes}`)
  if (meta.urlsNoSitemapProduto !== null) linhas.push(`- URLs nos sitemaps de produto: ${meta.urlsNoSitemapProduto}`)
  if (meta.urlsSitemapComBarraDupla !== null && meta.urlsNoSitemapProduto) {
    const pct = ((meta.urlsSitemapComBarraDupla / meta.urlsNoSitemapProduto) * 100).toFixed(1).replace(".", ",")
    linhas.push(`- URLs do sitemap de produto com "//" no caminho: ${meta.urlsSitemapComBarraDupla} (${pct}%)`)
  }
  if (meta.bloqueadasRobots.length) linhas.push(`- URLs puladas por robots.txt: ${meta.bloqueadasRobots.length}`)
  linhas.push("")

  if (produtos.length) {
    const ok = produtos.filter((p) => p.dados.status === 200)
    linhas.push(`## Produtos (${produtos.length} auditados, ${ok.length} com HTTP 200)`, "")
    linhas.push(tabelaRegras(produtos.map((p) => ({ achados: p.achados, url: p.dados.urlFinal }))))
    linhas.push("### Categorias principais observadas (top 15 da amostra)", "")
    const arvore = arvoreObservada(produtos).slice(1, 16)
    linhas.push("| Caminho | Produtos | % amostra | ID |", "|---|---|---|---|")
    for (const l of arvore) linhas.push(`| ${l[0]} | ${l[1]} | ${l[2]} | ${l[4] ?? ""} |`)
    linhas.push("")
  }
  if (categorias.length) {
    linhas.push(`## Categorias (${categorias.length} auditadas)`, "")
    linhas.push(tabelaRegras(categorias.map((c) => ({ achados: c.achados, url: c.dados.urlFinal }))))
  }
  linhas.push(
    "## Limitações",
    "",
    "- Amostra: os percentuais valem para a amostra, não para o catálogo inteiro. Extrapolar só com amostra representativa.",
    "- Fonte: HTML servido (sem executar JS). Elementos renderizados só no navegador (ex.: H1 em React) aparecem como ausentes, que é o que crawlers de IA sem JS enxergam.",
    "- Listas de termos (técnico/promocional/genérico/marcas) são heurísticas em `config.ts`; a classificação final é do negócio.",
    "- Sugestão Marca > Modelo vem do bloco \"Marca/Modelo/Compatibilidade\" da descrição; não substitui a decisão de taxonomia.",
    "",
  )
  return linhas.join("\n")
}
