/**
 * Consolida os pilotos de todas as marcas numa entrega única de recategorização (somente leitura, offline).
 *
 * Saída em output/catalog-audit/recategorizacao/:
 *   categorias-magazord-completo.csv  árvore completa no formato de importação da Magazord
 *   mudancas-completo.csv             renomear, criar, fundir, manter, desativar (com id da categoria atual)
 *   produtos-recategorizacao.csv      nova categoria principal por produto
 *   seo-categorias.csv                H1, título e meta description sugeridos por categoria
 *   pendencias-*.csv                  fusões a confirmar, produtos sem modelo, produtos sem marca de moto
 *   resumo-recategorizacao.md
 *
 * Uso: npm run audit:consolidar -- --marcas honda,yamaha,... [--sufixo corte10]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"
import type { ProdutoMagazord } from "./magazord"
import { tokenizar } from "./taxonomy"

const SEP = " > "
const fmt = (n: number) => n.toLocaleString("pt-BR")
const csvExcel = (linhas: (string | number | null)[][]) =>
  "﻿" + linhas.map((l) => l.map((v) => { const s = v === null ? "" : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(";")).join("\r\n") + "\r\n"
const csvMagazord = (linhas: string[][]) => linhas.map((l) => l.map((s) => (/[\s;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)).join(";")).join("\n") + "\n"

/** "COMET 250" -> "Comet 250", "CB 500 F" -> "CB 500 F", "HARLEY-DAVIDSON" -> "Harley-Davidson". */
const legivel = (s: string) =>
  s
    .split(" ")
    .map((w) => w.split("-").map((p) => (/\d/.test(p) || p.length <= 3 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join("-"))
    .join(" ")

function main(): void {
  const { values } = parseArgs({ options: { marcas: { type: "string" }, sufixo: { type: "string" } } })
  const marcas = (values.marcas ?? "").split(/[,\s]+/).map((m) => m.trim()).filter(Boolean)
  if (!marcas.length) throw new Error("Informe --marcas")
  const sufixo = values.sufixo ?? "corte10"
  const base = join("output", "catalog-audit", "piloto")
  const saida = join("output", "catalog-audit", "recategorizacao")
  mkdirSync(saida, { recursive: true })
  const api = join("output", "catalog-audit", "api")
  const norm = (s: string) => tokenizar(s).join(" ")
  const marcasApi = new Map((JSON.parse(readFileSync(join(api, "marcas.json"), "utf-8")) as { id: number; nome: string }[]).map((m) => [m.id, norm(m.nome)]))
  const produtosApi = new Map<string, ProdutoMagazord>()
  for (const l of readFileSync(join(api, "produtos.jsonl"), "utf-8").split("\n")) if (l) {
    const p = JSON.parse(l) as ProdutoMagazord
    produtosApi.set(String(p.id), p)
  }

  interface Dados { marca: string; raiz: string; raizAtual: string; produtos: Record<string, string>[]; arvore: Record<string, string>[]; mudancas: Record<string, string>[]; paginas: Record<string, string>[] }
  const porMarca: Dados[] = marcas.map((m) => {
    const dir = join(base, m)
    const ler = (a: string) => (existsSync(join(dir, a)) ? lerCsv(readFileSync(join(dir, a), "utf-8")) : [])
    const arvore = ler(`categorias-magazord-${sufixo}.csv`)
    const mudancas = ler(`mudancas-${sufixo}.csv`)
    const raiz = arvore[0]?.Nome.trim() ?? m.toUpperCase()
    const ren = mudancas.find((r) => r.acao === "RENOMEAR_RAIZ")
    return { marca: m, raiz, raizAtual: ren ? ren.categoria_atual : raiz, produtos: ler(`produtos-${sufixo}.csv`), arvore, mudancas, paginas: ler(`modelos-paginas-${sufixo}.csv`) }
  })

  // 1) Um produto, uma marca
  const candidatos = new Map<string, { d: Dados; r: Record<string, string> }[]>()
  for (const d of porMarca) for (const r of d.produtos) candidatos.set(r.id, [...(candidatos.get(r.id) ?? []), { d, r }])
  const escolhido = new Map<string, { d: Dados; r: Record<string, string> }>()
  let conflitos = 0
  for (const [id, cs] of candidatos) {
    if (cs.length === 1) { escolhido.set(id, cs[0]); continue }
    conflitos++
    const comCategoria = cs.filter((c) => c.r.nova_categoria_principal)
    const pool = comCategoria.length ? comCategoria : cs
    const naArvore = pool.find((c) => c.r.categoria_principal_atual.split(SEP)[0] === c.d.raizAtual)
    const p = produtosApi.get(id)
    const daApi = pool.find((c) => p && p.marca !== null && marcasApi.get(p.marca) === norm(c.d.marca.replace(/-/g, " ")))
    escolhido.set(id, naArvore ?? daApi ?? pool[0])
  }

  // 2) Contagem final por caminho (nó e ancestrais)
  const contagem = new Map<string, number>()
  for (const { r } of escolhido.values()) {
    if (!r.nova_categoria_principal) continue
    const partes = r.nova_categoria_principal.split(SEP)
    for (let i = 1; i <= partes.length; i++) contagem.set(partes.slice(0, i).join(SEP), (contagem.get(partes.slice(0, i).join(SEP)) ?? 0) + 1)
  }

  // 3) Árvore: mantém raiz, categorias que já existem (mesmo vazias) e nós com produto
  const arvore: string[][] = [["Nome", "Nome Pai", "Tipo", "Ordem", "Filtro"]]
  const mud: (string | number | null)[][] = [["marca", "acao", "categoria_atual", "categoria_nova", "produtos", "motivo", "id_categoria_atual"]]
  const removidos = new Set<string>()
  for (const d of porMarca) {
    const existentes = new Set(d.mudancas.filter((x) => ["MANTER", "MANTER_SEM_PRODUTOS", "MANTER_SEPARADO", "FUNDIR"].includes(x.acao)).map((x) => x.categoria_nova))
    for (const n of d.arvore) {
      const cam = [n["Nome Pai"].trim(), n.Nome.trim()].filter(Boolean).join(SEP)
      const raiz = !n["Nome Pai"].trim()
      if (raiz || existentes.has(cam) || (contagem.get(cam) ?? 0) > 0) arvore.push([n.Nome.trim(), n["Nome Pai"].trim(), n.Tipo || "Produto", n.Ordem ?? "", n.Filtro || "1"])
      else removidos.add(cam)
    }
    for (const x of d.mudancas) {
      if (x.acao === "CRIAR" && removidos.has(x.categoria_nova)) continue
      const n = x.categoria_nova && contagem.has(x.categoria_nova) && ["MANTER", "CRIAR", "MANTER_SEPARADO"].includes(x.acao) ? contagem.get(x.categoria_nova) ?? 0 : Number(x.produtos) || 0
      mud.push([d.raiz, x.acao, x.categoria_atual || null, x.categoria_nova || null, n, x.motivo, x.id_categoria_atual || null])
    }
  }
  writeFileSync(join(saida, "categorias-magazord-completo.csv"), csvMagazord(arvore))
  writeFileSync(join(saida, "mudancas-completo.csv"), csvExcel(mud))

  // 4) Produtos
  const prod: (string | number | null)[][] = [["marca", "codigo", "id", "nome", "ativo", "acao", "categoria_principal_atual", "nova_categoria_principal", "categorias_atuais_manter_como_secundarias", "sistema", "observacao"]]
  for (const { d, r } of escolhido.values()) prod.push([d.raiz, r.codigo, r.id, r.nome, r.ativo, r.acao, r.categoria_principal_atual, r.nova_categoria_principal || null, r.categorias_atuais_manter_como_secundarias, r.sistema, r.observacao])
  writeFileSync(join(saida, "produtos-recategorizacao.csv"), csvExcel(prod))

  // 5) SEO por categoria
  const paginas = new Map<string, Record<string, string>>()
  for (const d of porMarca) for (const p of d.paginas) paginas.set(`${d.raiz}${SEP}${p.modelo}`, p)
  const seo: (string | number | null)[][] = [["categoria", "nivel", "produtos", "h1_sugerido", "titulo_sugerido", "meta_description_sugerida", "pagina_publica", "situacao_pagina", "cliques_produtos_6m", "impressoes_produtos_6m"]]
  for (const n of arvore.slice(1)) {
    const pai = n[1]
    const cam = [pai, n[0]].filter(Boolean).join(SEP)
    const partes = cam.split(SEP)
    const marca = legivel(partes[0])
    const qtd = contagem.get(cam) ?? 0
    if (partes.length === 1) {
      seo.push([cam, "marca", qtd, `Peças ${marca}`, `Peças ${marca} usadas e originais com garantia`, `Peças usadas e originais para motos ${marca}, retiradas de motos com baixa e nota fiscal. Encontre pelo modelo da sua moto.`, null, null, null, null])
    } else if (partes.length === 2) {
      const modelo = legivel(partes[1])
      const pg = paginas.get(cam)
      seo.push([cam, "modelo", qtd, `Peças ${marca} ${modelo}`, `${modelo} - Peças usadas originais com garantia`, `Peças usadas e originais para ${marca} ${modelo}: motor, elétrica, carenagem, freios e mais, com garantia e nota fiscal.`, pg ? pg.pagina_publica : null, pg ? pg.situacao_pagina : null, pg ? pg.cliques_produtos_6m : null, pg ? pg.impressoes_produtos_6m : null])
    } else {
      const modelo = legivel(partes[1])
      const sistema = partes[2]
      seo.push([cam, "subcategoria", qtd, `${sistema} ${marca} ${modelo}`, `${sistema} ${marca} ${modelo} - Peças usadas originais com garantia`, `Peças de ${sistema.toLowerCase()} para ${marca} ${modelo}, usadas e originais, com garantia e nota fiscal.`, null, null, null, null])
    }
  }
  writeFileSync(join(saida, "seo-categorias.csv"), csvExcel(seo))

  // 6) Pendências
  writeFileSync(join(saida, "pendencias-fusoes-a-confirmar.csv"), csvExcel([["marca", "modelo", "possivel_mesmo_que", "produtos", "id_categoria_atual"], ...mud.slice(1).filter((x) => x[1] === "REVISAR_FUSAO").map((x) => [x[0], x[2], x[3], x[4], x[6]])]))
  const semModelo = Array.from(escolhido.values()).filter(({ r }) => r.acao === "REVISAR_SEM_MODELO")
  writeFileSync(join(saida, "pendencias-sem-modelo.csv"), csvExcel([["marca", "codigo", "id", "nome", "ativo", "categoria_principal_atual", "observacao"], ...semModelo.map(({ d, r }) => [d.raiz, r.codigo, r.id, r.nome, r.ativo, r.categoria_principal_atual, r.observacao])]))
  const marcasNome = new Map((JSON.parse(readFileSync(join(api, "marcas.json"), "utf-8")) as { id: number; nome: string }[]).map((m) => [m.id, m.nome.trim()]))
  const semMarca = Array.from(produtosApi.values()).filter((p) => !escolhido.has(String(p.id)))
  writeFileSync(join(saida, "pendencias-sem-marca-de-moto.csv"), csvExcel([["codigo", "id", "nome", "ativo", "marca_cadastrada", "categorias_atuais_ids"], ...semMarca.map((p) => [p.codigo, p.id, p.nome, p.ativo ? "sim" : "não", p.marca !== null ? marcasNome.get(p.marca) ?? String(p.marca) : "", p.categorias.join(",")])]))

  // 7) Resumo
  const md: string[] = ["# Recategorização do catálogo", "", "Estrutura: Marca > Modelo > Sistema (subcategoria quando o modelo tem 10 ou mais peças no sistema). Somente leitura: nada foi alterado na loja.", ""]
  const totProd = escolhido.size
  const conta = (pred: (r: Record<string, string>) => boolean) => Array.from(escolhido.values()).filter(({ r }) => pred(r)).length
  md.push(`- Produtos com marca de moto: ${fmt(totProd)} | sem marca de moto (pendência): ${fmt(semMarca.length)} | atribuídos a duas marcas e resolvidos: ${fmt(conflitos)}`)
  md.push(`- Saem de "Mercado Livre": ${fmt(conta((r) => r.acao === "RECATEGORIZAR"))} | saem do grupo genérico: ${fmt(conta((r) => r.acao === "AJUSTAR_PRINCIPAL"))} | duplicados (decisão da loja): ${fmt(conta((r) => r.acao === "DUPLICADO"))} | sem modelo (revisar): ${fmt(semModelo.length)}`)
  const niveis = { marca: 0, modelo: 0, sub: 0 }
  for (const n of arvore.slice(1)) {
    const prof = [n[1], n[0]].filter(Boolean).join(SEP).split(SEP).length
    if (prof === 1) niveis.marca++
    else if (prof === 2) niveis.modelo++
    else niveis.sub++
  }
  md.push(`- Árvore: ${fmt(arvore.length - 1)} categorias (${fmt(niveis.marca)} marcas, ${fmt(niveis.modelo)} modelos, ${fmt(niveis.sub)} subcategorias de sistema)`, "")
  md.push("## Por marca", "", "| Marca | Produtos | Modelos | Subcategorias | Raiz | Páginas de modelo a criar | Fusões a confirmar | Sem modelo |", "|---|---|---|---|---|---|---|---|")
  for (const d of porMarca) {
    const prods = Array.from(escolhido.values()).filter((x) => x.d === d)
    const nos = arvore.slice(1).filter((n) => [n[1], n[0]].filter(Boolean).join(SEP).split(SEP)[0] === d.raiz)
    const mods = nos.filter((n) => n[1] === d.raiz).length
    const subs = nos.filter((n) => n[1].includes(SEP)).length
    const raizAcao = d.mudancas.find((x) => x.acao === "RENOMEAR_RAIZ") ? `renomear (${d.raizAtual} → ${d.raiz})` : d.mudancas.find((x) => x.acao === "CRIAR" && !x.categoria_nova.includes(SEP)) ? "criar" : "mantém"
    const criar = d.paginas.filter((p) => p.situacao_pagina === "CRIAR" && Number(p.produtos) > 0 && !removidos.has(`${d.raiz}${SEP}${p.modelo}`)).length
    const fus = d.mudancas.filter((x) => x.acao === "REVISAR_FUSAO").length
    const sm = prods.filter((x) => x.r.acao === "REVISAR_SEM_MODELO").length
    md.push(`| ${d.raiz} | ${fmt(prods.length)} | ${fmt(mods)} | ${fmt(subs)} | ${raizAcao} | ${fmt(criar)} | ${fmt(fus)} | ${fmt(sm)} |`)
  }
  md.push(
    "",
    "## Arquivos",
    "",
    "| Arquivo | Para quê |",
    "|---|---|",
    "| `categorias-magazord-completo.csv` | Árvore final no formato de importação da Magazord |",
    "| `mudancas-completo.csv` | O que muda na árvore atual, com o id da categoria (renomear raiz, criar, fundir, desativar após migrar) |",
    "| `produtos-recategorizacao.csv` | Nova categoria principal de cada produto (manter as atuais como secundárias) |",
    "| `seo-categorias.csv` | H1, título e meta description sugeridos por categoria, página pública e demanda |",
    "| `pendencias-fusoes-a-confirmar.csv` | Modelos que podem ser a mesma moto (conferir pela FIPE) |",
    "| `pendencias-sem-modelo.csv` | Produtos sem modelo no nome (com sugestão por lote quando houver) |",
    "| `pendencias-sem-marca-de-moto.csv` | Produtos cuja marca não é de moto (pneus, \"TODAS\", \"SEM MARCA\"…) |",
    "| `../api/duplicados.csv` | Cópias de produtos para a loja decidir antes de recategorizar |",
    "",
  )
  writeFileSync(join(saida, "resumo-recategorizacao.md"), md.join("\n"))
  console.log(md.slice(0, 8).join("\n"))
}

try {
  main()
} catch (e) {
  console.error("[consolidar] Erro fatal:", e)
  process.exitCode = 1
}
