/**
 * Análise do GSC (exportação "Desempenho" da interface: Consultas.csv e Páginas.csv) para validar a taxonomia.
 * Classifica consultas (loja, peça+modelo, "peças"+modelo, peça sem modelo, desmanche…) e páginas
 * (produto, modelo, marca, tipo de peça, "ver todos", URL com "//"…). Somente leitura, offline.
 *
 * Uso: npm run audit:gsc -- --dir <pasta com Consultas.csv e Páginas.csv> [--categorias categorias-publicas.txt]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"
import { MARCAS_SLUG, classificarSistema, limparModelo, tokenizar } from "./taxonomy"

const num = (s: string) => Number(String(s ?? "").replace(/%/g, "").replace(",", ".")) || 0
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR")
const pct = (a: number, b: number) => `${((a / (b || 1)) * 100).toFixed(1).replace(".", ",")}%`
function csvExcel(linhas: (string | number | null)[][]): string {
  const cel = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n") + "\r\n"
}

const LOJA = ["chapa", "chapamotoparts", "chapamotos", "chapamotors", "motochapa"]
const DESMANCHE = ["desmanche", "desmanches", "ferro", "sucata", "leilao", "usadas", "usada", "usados", "usado", "seminova"]
const GENERICO_PECA = ["peca", "pecas"]
const PARADAS = new Set(["de", "da", "do", "das", "dos", "para", "pra", "p", "a", "e", "com", "c", "moto", "motos", "original", "originais", "preco", "valor", "comprar", "onde", "venda", "vende", "mercado", "livre", "olx"])
/** Termos que nomeiam o sistema inteiro (não uma peça): indicam busca por "categoria de sistema". */
const TERMO_SISTEMA = new Set(["freio", "freios", "carenagem", "carenagens", "suspensao", "escapamento", "escape", "embreagem", "eletrica", "parte eletrica", "iluminacao", "arrefecimento", "injecao", "cambio", "transmissao"])

function main(): void {
  const { values } = parseArgs({ options: { dir: { type: "string" }, categorias: { type: "string" }, saida: { type: "string" } } })
  if (!values.dir) throw new Error("Informe --dir com Consultas.csv e Páginas.csv")
  const api = join("output", "catalog-audit", "api")
  const saida = values.saida ?? join("output", "catalog-audit", "gsc")
  mkdirSync(saida, { recursive: true })

  // Dicionários: marcas, modelos (árvore + classificador), tipos de peça, páginas públicas e produtos do sitemap
  const marcasTok = MARCAS_SLUG.map((m) => ({ marca: m.canonica, tokens: m.tokens }))
  const tokensMarca = new Set(MARCAS_SLUG.flatMap((m) => m.tokens))
  const raizMarca = new Map(lerCsv(readFileSync(join(api, "raizes-marca.csv"), "utf-8")).map((r) => [r.raiz_id, r.marca_majoritaria]))
  const modelos = new Map<string, { marca: string; nome: string }>()
  const addModelo = (nome: string, marca: string) => {
    const seq = limparModelo(tokenizar(nome).filter((t) => !tokensMarca.has(t)))
    if (seq.join("").length < 3 || !seq.some((t) => /[a-z]/.test(t)) || !seq.some((t) => /\d/.test(t) || t.length >= 4)) return
    const k = seq.join(" ")
    if (!modelos.has(k)) modelos.set(k, { marca, nome: nome.trim() })
  }
  for (const r of lerCsv(readFileSync(join(api, "arvore-categorias.csv"), "utf-8"))) if (r.nivel === "2" && raizMarca.has(r.pai)) addModelo(r.nome, raizMarca.get(r.pai) ?? "")
  const arqModelos = join("output", "catalog-audit", "classificacao", "modelos.csv")
  if (existsSync(arqModelos)) for (const r of lerCsv(readFileSync(arqModelos, "utf-8"))) if (Number(r.produtos) >= 5) addModelo(r.modelo_agrupado, r.marca)
  const seqModelos = Array.from(modelos.entries()).map(([k, v]) => ({ seq: k.split(" "), compacto: k.replace(/ /g, ""), ...v })).sort((a, b) => b.compacto.length - a.compacto.length)

  const cabecasPeca = new Set<string>()
  const arqTipos = join("output", "catalog-audit", "classificacao", "tipos-por-sistema.csv")
  if (existsSync(arqTipos)) {
    for (const r of lerCsv(readFileSync(arqTipos, "utf-8"))) {
      const t = (r.tipo_peca ?? "").split(" ")[0]
      if (Number(r.produtos) >= 30 && t && t.length >= 3 && !PARADAS.has(t) && r.sistema !== "Não classificado") cabecasPeca.add(t)
    }
  }
  for (const t of ["motor", "painel", "farol", "pneu", "pneus", "roda", "rodas", "freio", "carenagem", "escapamento", "bengala", "amortecedor", "radiador", "tanque", "banco", "carburador", "alternador", "embreagem", "cambio", "virabrequim", "cabecote", "pistao", "balanca", "quadro", "chassi"]) cabecasPeca.add(t)

  const catsPublicas = new Set<string>()
  if (values.categorias && existsSync(values.categorias)) for (const l of readFileSync(values.categorias, "utf-8").split(/\r?\n/)) if (l.trim()) catsPublicas.add(l.trim().replace(/^\/+|\/+$/g, ""))
  const produtosSitemap = new Set<string>()
  const arqUrls = join("output", "catalog-audit", "classificacao", "urls-produto.txt")
  if (existsSync(arqUrls)) for (const u of readFileSync(arqUrls, "utf-8").split("\n")) if (u) produtosSitemap.add(u.replace(/^https?:\/\/[^/]+\/+/, "").replace(/\/+$/, ""))
  const slugsMarca = new Set(MARCAS_SLUG.map((m) => m.canonica.replace(/ /g, "-")))

  // ---------- Consultas ----------
  const consultas = lerCsv(readFileSync(join(values.dir, "Consultas.csv"), "utf-8"), ",").map((r) => ({
    q: r["Top consultas"] ?? r[Object.keys(r)[0]], cliques: num(r.Cliques), imp: num(r["Impressões"]), pos: num(r["Posição"]),
  }))
  // Famílias: 1ª palavra do modelo (só letras, ≥ 4) que pertence a uma marca só ("hornet", "hayabusa", "tenere")
  const GENERICAS = new Set(["super", "street", "sport", "classic", "custom", "special", "touring", "speed", "racing", "standard", "turbo", "adventure", "duke", "ninja", "tiger", "gsxr"])
  const familiaMarca = new Map<string, Set<string>>()
  for (const m of seqModelos) {
    const f = m.seq[0]
    if (/^[a-z]{4,}$/.test(f)) familiaMarca.set(f, new Set([...(familiaMarca.get(f) ?? []), m.marca]))
  }
  const familias = new Map(Array.from(familiaMarca.entries()).filter(([f, ms]) => ms.size === 1 && !GENERICAS.has(f) && !cabecasPeca.has(f)).map(([f, ms]) => [f, Array.from(ms)[0]]))
  const temLetraENumero = (x: string) => /[a-z]/.test(x) && /\d/.test(x)
  const acharModelo = (t: string[]) => {
    // 1) nome completo ou colado ("cb 650 f" / "cb650f")
    for (const m of seqModelos) {
      for (let i = 0; i < t.length; i++) {
        if (m.seq.every((x, k) => t[i + k] === x)) return { ...m, inicio: i, fim: i + m.seq.length }
        for (let n = 1; n <= 4 && i + n <= t.length; n++) if (t.slice(i, i + n).join("") === m.compacto) return { ...m, inicio: i, fim: i + n }
      }
    }
    // 2) parte do nome com número, em qualquer ordem ("srad 750" ⊂ "gsxr 750 srad", "ninja 250" ⊂ "ninja 250 r")
    let melhor: { m: (typeof seqModelos)[number]; i: number; n: number; sobra: number } | null = null
    for (let i = 0; i < t.length; i++) {
      for (let n = Math.min(3, t.length - i); n >= 2; n--) {
        const trecho = t.slice(i, i + n)
        if (!trecho.some((x) => /\d/.test(x)) || !trecho.some((x) => /[a-z]/.test(x))) continue
        for (const m of seqModelos) {
          if (trecho.every((x) => m.seq.includes(x))) {
            const sobra = m.seq.length - n
            if (!melhor || n > melhor.n || (n === melhor.n && sobra < melhor.sobra)) melhor = { m, i, n, sobra }
          }
        }
      }
    }
    if (melhor) return { ...melhor.m, inicio: melhor.i, fim: melhor.i + melhor.n }
    // 3) código alfanumérico isolado ("r15", "xj6", "z800")
    for (let i = 0; i < t.length; i++) {
      if (!temLetraENumero(t[i]) || t[i].length < 2) continue
      const m = seqModelos.find((x) => x.seq.includes(t[i]) || x.compacto === t[i])
      if (m) return { ...m, inicio: i, fim: i + 1 }
    }
    // 4) família ("hornet", "hayabusa", "tenere")
    for (let i = 0; i < t.length; i++) {
      const marca = familias.get(t[i])
      if (marca) return { seq: [t[i]], compacto: t[i], marca, nome: t[i].toUpperCase(), inicio: i, fim: i + 1 }
    }
    return null
  }
  const classif = consultas.map((c) => {
    const t = tokenizar(c.q)
    const loja = t.some((x) => LOJA.includes(x)) || /chapa ?moto/.test(t.join(" "))
    const marca = marcasTok.find((m) => t.some((_, i) => m.tokens.every((x, k) => t[i + k] === x)))?.marca ?? null
    const modelo = acharModelo(t)
    const resto = t.filter((x, i) => !(modelo && i >= modelo.inicio && i < modelo.fim) && !tokensMarca.has(x) && !PARADAS.has(x) && !/^\d{2,4}$/.test(x) && !DESMANCHE.includes(x) && !GENERICO_PECA.includes(x))
    const peca = resto.some((x) => cabecasPeca.has(x)) ? resto.join(" ") : ""
    const generico = t.some((x) => GENERICO_PECA.includes(x))
    const desmanche = t.some((x) => DESMANCHE.includes(x))
    const temVeiculo = !!modelo || !!marca
    let tipo: string
    if (loja) tipo = "LOJA (marca Chapa)"
    else if (peca && temVeiculo) tipo = "PEÇA + MODELO/MARCA"
    else if (generico && temVeiculo) tipo = "\"PEÇAS\" + MODELO/MARCA"
    else if (peca) tipo = "PEÇA SEM MODELO"
    else if (desmanche) tipo = "DESMANCHE/USADO GENÉRICO"
    else if (temVeiculo) tipo = "SÓ MODELO/MARCA"
    else if (t.some((x) => ["quem", "qual", "quais", "como", "melhor", "melhores", "lancamento", "lancamentos", "esportiva", "esportivas", "custom", "customizada", "inventou", "criou", "tipos", "modelos"].includes(x))) tipo = "INFORMACIONAL (sem peça)"
    else tipo = "OUTRO"
    const sistema = peca ? classificarSistema(peca) : ""
    const termoSistema = peca && TERMO_SISTEMA.has(resto.join(" "))
    const motorCompleto = /\bmotor\b/.test(peca) && resto.length <= 2
    return { ...c, tipo, marca: modelo?.marca ?? marca, modelo: modelo?.nome ?? null, peca, sistema, termoSistema, motorCompleto }
  })
  const totC = consultas.reduce((a, c) => a + c.cliques, 0)
  const totI = consultas.reduce((a, c) => a + c.imp, 0)
  const porTipo = new Map<string, { n: number; c: number; i: number }>()
  for (const c of classif) {
    const v = porTipo.get(c.tipo) ?? { n: 0, c: 0, i: 0 }
    v.n++; v.c += c.cliques; v.i += c.imp
    porTipo.set(c.tipo, v)
  }
  writeFileSync(join(saida, "consultas-classificadas.csv"), csvExcel([["consulta", "cliques", "impressoes", "posicao", "tipo", "marca", "modelo", "peca", "sistema", "termo_de_sistema", "motor_completo"], ...classif.map((c) => [c.q, c.cliques, c.imp, c.pos, c.tipo, c.marca, c.modelo, c.peca, c.sistema, c.termoSistema ? "sim" : "", c.motorCompleto ? "sim" : ""])]))

  // Demanda por modelo e por sistema
  const porModelo = new Map<string, { marca: string; c: number; i: number; n: number }>()
  for (const c of classif) if (c.modelo) {
    const v = porModelo.get(c.modelo) ?? { marca: c.marca ?? "", c: 0, i: 0, n: 0 }
    v.c += c.cliques; v.i += c.imp; v.n++
    porModelo.set(c.modelo, v)
  }
  const pecaModelo = classif.filter((c) => c.tipo === "PEÇA + MODELO/MARCA")
  const porSistema = new Map<string, { c: number; i: number; n: number }>()
  for (const c of pecaModelo) {
    const k = c.motorCompleto ? "Motor completo / motor" : c.sistema || "Não classificado"
    const v = porSistema.get(k) ?? { c: 0, i: 0, n: 0 }
    v.c += c.cliques; v.i += c.imp; v.n++
    porSistema.set(k, v)
  }
  const termoSis = pecaModelo.filter((c) => c.termoSistema)

  // ---------- Páginas ----------
  const paginas = lerCsv(readFileSync(join(values.dir, "Páginas.csv"), "utf-8"), ",").map((r) => ({
    url: r["Páginas principais"] ?? r[Object.keys(r)[0]], cliques: num(r.Cliques), imp: num(r["Impressões"]), pos: num(r["Posição"]),
  }))
  const tipoPagina = (url: string) => {
    let u: URL
    try {
      u = new URL(url)
    } catch (e) {
      console.error("[gsc] URL inválida:", url, e)
      return { tipo: "INVÁLIDA", slug: "", barraDupla: false, params: false }
    }
    const barraDupla = /^\/\//.test(u.pathname)
    const slug = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, "")
    const params = !!u.search
    let tipo: string
    if (!slug) tipo = "HOME"
    else if (slug.startsWith("blog")) tipo = "BLOG"
    else if (slug.startsWith("ver-todos-")) tipo = "VER TODOS (duplica marca)"
    else if (catsPublicas.has(slug)) {
      if (slugsMarca.has(slug)) tipo = "PÁGINA DE MARCA"
      else if (cabecasPeca.has(slug.split("-")[0]) || cabecasPeca.has(slug.split("-")[0].replace(/s$/, "")) || ["motor", "pecas-motor"].includes(slug)) tipo = "PÁGINA DE TIPO DE PEÇA"
      else if (/black|produtos-\d|off|promo/.test(slug)) tipo = "PÁGINA PROMOCIONAL"
      else tipo = "PÁGINA DE MODELO/FAMÍLIA"
    } else if (produtosSitemap.has(slug)) tipo = "PRODUTO (no sitemap)"
    else tipo = "PRODUTO/OUTRA (fora do sitemap)"
    return { tipo, slug, barraDupla, params }
  }
  const pagsC = paginas.map((p) => ({ ...p, ...tipoPagina(p.url) }))
  const totPC = paginas.reduce((a, p) => a + p.cliques, 0)
  const totPI = paginas.reduce((a, p) => a + p.imp, 0)
  const porTipoPag = new Map<string, { n: number; c: number; i: number }>()
  for (const p of pagsC) {
    const v = porTipoPag.get(p.tipo) ?? { n: 0, c: 0, i: 0 }
    v.n++; v.c += p.cliques; v.i += p.imp
    porTipoPag.set(p.tipo, v)
  }
  writeFileSync(join(saida, "paginas-classificadas.csv"), csvExcel([["url", "cliques", "impressoes", "posicao", "tipo", "barra_dupla", "com_parametro"], ...pagsC.map((p) => [p.url, p.cliques, p.imp, p.pos, p.tipo, p.barraDupla ? "sim" : "", p.params ? "sim" : ""])]))
  const pagPorSlug = new Map(pagsC.map((p) => [p.slug, p]))
  const slugDe = (s: string) => tokenizar(s).join("-")

  // ---------- Resumo ----------
  const md: string[] = []
  md.push("# GSC × taxonomia", "", `Fonte: exportação da interface do GSC (1.000 principais consultas e 1.000 principais páginas). As consultas somam ${fmt(totC)} cliques e as páginas ${fmt(totPC)} cliques.`, "")
  md.push("## Consultas por intenção", "", "| Tipo | Consultas | Cliques | % cliques | Impressões | % impr. |", "|---|---|---|---|---|---|")
  for (const [k, v] of Array.from(porTipo.entries()).sort((a, b) => b[1].i - a[1].i)) md.push(`| ${k} | ${fmt(v.n)} | ${fmt(v.c)} | ${pct(v.c, totC)} | ${fmt(v.i)} | ${pct(v.i, totI)} |`)
  md.push("", "## Peça + modelo: por sistema", "", "| Sistema | Consultas | Cliques | Impressões |", "|---|---|---|---|")
  for (const [k, v] of Array.from(porSistema.entries()).sort((a, b) => b[1].i - a[1].i)) md.push(`| ${k} | ${fmt(v.n)} | ${fmt(v.c)} | ${fmt(v.i)} |`)
  md.push("", `Consultas que nomeiam o sistema inteiro com o modelo (ex.: "freios cb 500", "carenagem comet 250"): ${fmt(termoSis.length)} de ${fmt(pecaModelo.length)}, com ${fmt(termoSis.reduce((a, c) => a + c.imp, 0))} impressões.`, "")
  for (const c of termoSis.slice(0, 15)) md.push(`- ${c.q} (${fmt(c.imp)} impr., pos. ${c.pos})`)
  md.push("", "## Modelos com mais demanda nas consultas", "", "| Modelo | Marca | Consultas | Cliques | Impressões | Página pública | Impr. da página |", "|---|---|---|---|---|---|---|")
  for (const [m, v] of Array.from(porModelo.entries()).sort((a, b) => b[1].i - a[1].i).slice(0, 30)) {
    const s = slugDe(m)
    const temPag = catsPublicas.has(s)
    md.push(`| ${m} | ${v.marca} | ${fmt(v.n)} | ${fmt(v.c)} | ${fmt(v.i)} | ${temPag ? `/${s}` : "não"} | ${temPag && pagPorSlug.get(s) ? fmt(pagPorSlug.get(s)?.imp ?? 0) : "—"} |`)
  }
  md.push("", "## Páginas por tipo", "", "| Tipo | Páginas | Cliques | % cliques | Impressões | % impr. |", "|---|---|---|---|---|---|")
  for (const [k, v] of Array.from(porTipoPag.entries()).sort((a, b) => b[1].c - a[1].c)) md.push(`| ${k} | ${fmt(v.n)} | ${fmt(v.c)} | ${pct(v.c, totPC)} | ${fmt(v.i)} | ${pct(v.i, totPI)} |`)
  const dupla = pagsC.filter((p) => p.barraDupla)
  md.push("", `URLs com "//" entre as 1.000 páginas: ${fmt(dupla.length)} (${fmt(dupla.reduce((a, p) => a + p.cliques, 0))} cliques). URLs com parâmetro: ${fmt(pagsC.filter((p) => p.params).length)}.`, "")
  md.push("### Páginas de categoria (públicas) com desempenho", "", "| URL | Tipo | Cliques | Impressões | Posição |", "|---|---|---|---|---|")
  for (const p of pagsC.filter((x) => /PÁGINA|VER TODOS/.test(x.tipo)).sort((a, b) => b.imp - a.imp).slice(0, 40)) md.push(`| /${p.slug} | ${p.tipo} | ${fmt(p.cliques)} | ${fmt(p.imp)} | ${p.pos} |`)
  md.push("", "## Limitações", "", "- Exportação da interface: só as 1.000 principais consultas e páginas, sem a combinação consulta × página.", `- As 1.000 consultas cobrem uma parte pequena dos cliques: a busca da loja é pulverizada em cauda longa.`, "- Classificação por dicionário (modelos da árvore e do catálogo, tipos de peça do catálogo); revisar casos isolados em `consultas-classificadas.csv`.", "")
  writeFileSync(join(saida, "resumo-gsc.md"), md.join("\n"))
  console.log(`[gsc] ${consultas.length} consultas e ${paginas.length} páginas -> ${saida}`)
}

try {
  main()
} catch (e) {
  console.error("[gsc] Erro fatal:", e)
  process.exitCode = 1
}
