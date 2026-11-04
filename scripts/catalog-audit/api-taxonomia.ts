/**
 * Proposta de reestruturação (somente leitura, offline): lê os arquivos baixados por `npm run audit:api`
 * e gera planilhas para a loja aplicar no admin. Não chama a API.
 *
 * Saídas (em --dir):
 *   renomear-raizes.csv      raízes com nome de modelo -> nome da marca
 *   modelos-de-para.csv      modelo classificado -> categoria de modelo existente (ou NOVA)
 *   taxonomia-proposta.csv   nós Marca > Modelo > Sistema com contagem e ação (criar subcategoria ou ficar no modelo)
 *   atribuicao-produtos.csv  produto -> nova categoria principal proposta
 *   resumo-taxonomia.md
 *
 * Uso: npm run audit:taxonomia -- [--dir output/catalog-audit/api] [--minimo-sistema 50] [--sitemap urls.txt]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import type { CategoriaMagazord, ProdutoMagazord } from "./magazord"
import { MARCAS_SLUG, aprenderDicionario, classificarTexto, limparModelo, tokenizar, type Classificacao } from "./taxonomy"

const CATEGORIA_TECNICA = 10095

function csv(linhas: (string | number | null)[][]): string {
  const celula = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n"
}
const pct = (n: number, total: number) => `${((n / (total || 1)) * 100).toFixed(1).replace(".", ",")}%`
const fmt = (n: number) => n.toLocaleString("pt-BR")

/** Nome de exibição da marca: Title Case, siglas preservadas. */
const SIGLAS = new Set(["bmw", "ktm", "mv", "fym", "mvk", "pgo"])
const nomeMarca = (m: string) =>
  m
    .split(" ")
    .map((p) => (SIGLAS.has(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(m === "harley davidson" ? "-" : " ")

const tokensMarca = new Set(MARCAS_SLUG.flatMap((m) => m.tokens))
/** Tokens do modelo sem a marca ("BMW C 650 GT" -> c 650 gt). */
const tokensModelo = (nome: string) => limparModelo(tokenizar(nome).filter((t) => !tokensMarca.has(t)))
const conjunto = (t: string[]) => new Set(t)
const contem = (a: Set<string>, b: Set<string>) => Array.from(b).every((x) => a.has(x))

function main(): void {
  const { values } = parseArgs({ options: { dir: { type: "string" }, "minimo-sistema": { type: "string" }, sitemap: { type: "string" } } })
  const dir = values.dir ?? join("output", "catalog-audit", "api")
  const minimo = Number(values["minimo-sistema"] ?? 10)

  const categorias = JSON.parse(readFileSync(join(dir, "categorias.json"), "utf-8")) as CategoriaMagazord[]
  const unicos = new Map<number, ProdutoMagazord>()
  for (const l of readFileSync(join(dir, "produtos.jsonl"), "utf-8").split("\n")) if (l) {
    const p = JSON.parse(l) as ProdutoMagazord
    unicos.set(p.id, p)
  }
  const produtos = Array.from(unicos.values())

  // Árvore
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const filhosDe = new Map<number, CategoriaMagazord[]>()
  for (const c of categorias) if (c.pai !== null) filhosDe.set(c.pai, [...(filhosDe.get(c.pai) ?? []), c])
  const caminho = (id: number): CategoriaMagazord[] => {
    const out: CategoriaMagazord[] = []
    let a = porId.get(id)
    const vistos = new Set<number>()
    while (a && !vistos.has(a.id)) {
      vistos.add(a.id)
      out.unshift(a)
      a = a.pai !== null ? porId.get(a.pai) : undefined
    }
    return out
  }
  const ehArvore = (id: number) => {
    const r = caminho(id)[0]
    return r !== undefined && r.id !== CATEGORIA_TECNICA && (filhosDe.get(r.id)?.length ?? 0) > 0
  }

  // Classificação pelo nome
  const slugs = values.sitemap && existsSync(values.sitemap) ? readFileSync(values.sitemap, "utf-8").split(/\r?\n/).filter(Boolean).map((u) => u.replace(/^https?:\/\/[^/]+\/+/, "")) : []
  const { modelos, familias } = aprenderDicionario([...produtos.map((p) => p.nome), ...slugs])
  // Reserva: marca cadastrada na API quando o nome do produto não traz a marca
  const marcasApi = new Map<number, string>()
  if (existsSync(join(dir, "marcas.json"))) {
    const lista = JSON.parse(readFileSync(join(dir, "marcas.json"), "utf-8")) as { id: number; nome: string }[]
    const conhecidas = new Set(MARCAS_SLUG.map((m) => m.canonica))
    for (const m of lista) {
      const n = tokenizar(m.nome).join(" ").replace(/^harley davidson$/, "harley davidson")
      if (conhecidas.has(n)) marcasApi.set(m.id, n)
    }
  }
  const classe = new Map<number, Classificacao>()
  let marcaPelaApi = 0
  for (const p of produtos) {
    const c = classificarTexto(String(p.id), p.nome, modelos, familias)
    if (!c.marca && p.marca !== null && marcasApi.has(p.marca)) {
      c.marca = marcasApi.get(p.marca) ?? null
      marcaPelaApi++
    }
    classe.set(p.id, c)
  }
  console.log(`[taxonomia] marca preenchida pelo cadastro da API em ${marcaPelaApi} produtos`)

  // 1) Raiz -> marca (maioria dos produtos ligados à árvore daquela raiz)
  const votos = new Map<number, Map<string, number>>()
  for (const p of produtos) {
    const marca = classe.get(p.id)?.marca
    if (!marca) continue
    for (const r of new Set(p.categorias.filter(ehArvore).map((c) => caminho(c)[0].id))) {
      const v = votos.get(r) ?? new Map<string, number>()
      v.set(marca, (v.get(marca) ?? 0) + 1)
      votos.set(r, v)
    }
  }
  const raizDaMarca = new Map<string, number>()
  const linhasRaiz: (string | number | null)[][] = [["raiz_id", "nome_atual", "nome_proposto", "produtos_classificados", "marca_majoritaria_pct", "acao", "observacao"]]
  const resumoRen: { atual: string; novo: string; n: number }[] = []
  for (const [r, v] of Array.from(votos.entries()).sort((a, b) => sum(b[1]) - sum(a[1]))) {
    const [marca, n] = Array.from(v.entries()).sort((a, b) => b[1] - a[1])[0]
    const total = sum(v)
    const atual = porId.get(r)?.nome.trim() ?? String(r)
    const proposto = nomeMarca(marca)
    const jaEhMarca = tokenizar(atual).join(" ") === marca.replace("-", " ")
    let acao = "RENOMEAR"
    let obs = ""
    if (jaEhMarca) {
      acao = atual === proposto ? "MANTER" : "PADRONIZAR_GRAFIA"
      if (acao === "PADRONIZAR_GRAFIA") obs = "Opcional: mesma marca, só a grafia (caixa) muda"
    }
    else if (total < 50) {
      acao = "REVISAR"
      obs = "Poucos produtos para decidir pela maioria"
    }
    if (acao !== "REVISAR" && !raizDaMarca.has(marca)) raizDaMarca.set(marca, r)
    if (acao === "RENOMEAR") resumoRen.push({ atual, novo: proposto, n: total })
    linhasRaiz.push([r, atual, proposto, total, pct(n, total), acao, obs])
  }
  writeFileSync(join(dir, "renomear-raizes.csv"), csv(linhasRaiz))

  // 2) Modelos: categorias de nível 2 por raiz, com tokens e volume atual
  const volumeCategoria = new Map<number, number>()
  for (const p of produtos) for (const c of p.categorias) volumeCategoria.set(c, (volumeCategoria.get(c) ?? 0) + 1)
  const modelosDaRaiz = new Map<number, { cat: CategoriaMagazord; tokens: Set<string>; volume: number }[]>()
  for (const [r, filhos] of filhosDe) {
    if (porId.get(r)?.pai !== null) continue
    modelosDaRaiz.set(
      r,
      filhos.map((cat) => {
        const netos = filhosDe.get(cat.id) ?? []
        const volume = (volumeCategoria.get(cat.id) ?? 0) + netos.reduce((a, n) => a + (volumeCategoria.get(n.id) ?? 0), 0)
        return { cat, tokens: conjunto(tokensModelo(cat.nome)), volume }
      }),
    )
  }
  type Match = { id: number | null; nome: string; tipo: "EXISTENTE" | "EXATO" | "ARVORE" | "CONTIDO" | "CONTEM" | "NOVO" | "SEM_MARCA" }
  const cacheMatch = new Map<string, Match>()
  const casarModelo = (marca: string | null, modelo: string | null): Match => {
    if (!marca || !modelo) return { id: null, nome: modelo?.toUpperCase() ?? "", tipo: "SEM_MARCA" }
    const chave = `${marca}|${modelo}`
    const cached = cacheMatch.get(chave)
    if (cached) return cached
    const raiz = raizDaMarca.get(marca)
    const alvo = conjunto(tokensModelo(modelo))
    const candidatos = raiz !== undefined ? (modelosDaRaiz.get(raiz) ?? []) : []
    const porVolume = (a: { volume: number }, b: { volume: number }) => b.volume - a.volume
    const alvoColado = tokensModelo(modelo).join("")
    const exato =
      candidatos.filter((c) => c.tokens.size === alvo.size && contem(c.tokens, alvo)).sort(porVolume)[0] ??
      // "ZX 10" = categoria "ZX10"
      candidatos.filter((c) => tokensModelo(c.cat.nome).join("") === alvoColado).sort(porVolume)[0]
    const contido = candidatos.filter((c) => alvo.size > 0 && contem(c.tokens, alvo)).sort(porVolume)[0]
    const contemCat = candidatos.filter((c) => c.tokens.size >= 2 && contem(alvo, c.tokens)).sort((a, b) => b.tokens.size - a.tokens.size || porVolume(a, b))[0]
    const m: Match = exato
      ? { id: exato.cat.id, nome: exato.cat.nome.trim(), tipo: "EXATO" }
      : contido
        ? { id: contido.cat.id, nome: contido.cat.nome.trim(), tipo: "CONTIDO" }
        : contemCat
          ? { id: contemCat.cat.id, nome: contemCat.cat.nome.trim(), tipo: "CONTEM" }
          : { id: null, nome: modelo.toUpperCase(), tipo: "NOVO" }
    cacheMatch.set(chave, m)
    return m
  }

  // 2b) Dicionário com os nomes de modelo da própria árvore (nível 2), para nomes que o classificador não resolveu
  const marcaDaRaiz = new Map(Array.from(raizDaMarca.entries()).map(([m, r]) => [r, m]))
  const modelosArvore: { seq: string[]; id: number; nome: string; marca: string }[] = []
  for (const [r, lista] of modelosDaRaiz) {
    const marca = marcaDaRaiz.get(r)
    if (!marca) continue
    for (const { cat } of lista) {
      const seq = tokensModelo(cat.nome)
      // Precisa ter parte com letras: "FYM 100" sem a marca viraria só "100" e casaria com medida de pneu
      if (seq.join("").length >= 3 && seq.some((t) => /[a-z]/.test(t))) modelosArvore.push({ seq, id: cat.id, nome: cat.nome.trim(), marca })
    }
  }
  modelosArvore.sort((a, b) => b.seq.length - a.seq.length || b.seq.join("").length - a.seq.join("").length)
  const casarPelaArvore = (nome: string, marcaConhecida: string | null): { marca: string; modelo: Match } | null => {
    const t = limparModelo(tokenizar(nome))
    for (const m of modelosArvore) {
      if (marcaConhecida && m.marca !== marcaConhecida) continue
      for (let i = 0; i + m.seq.length <= t.length; i++) {
        if (m.seq.every((x, k) => t[i + k] === x)) return { marca: m.marca, modelo: { id: m.id, nome: m.nome, tipo: "EXATO" } }
      }
    }
    return null
  }

  // 3) Destino de cada produto
  interface Destino { p: ProdutoMagazord; c: Classificacao | undefined; marca: string | null; modelo: Match; sistema: string }
  const destinos: Destino[] = produtos.map((p) => {
    const c = classe.get(p.id)
    const naArvore = p.categorias.filter(ehArvore).sort((a, b) => caminho(b).length - caminho(a).length)[0]
    if (naArvore !== undefined) {
      const cam = caminho(naArvore)
      const raiz = cam[0].id
      const marcaRaiz = Array.from(raizDaMarca.entries()).find(([, r]) => r === raiz)?.[0] ?? c?.marca ?? null
      const modeloCat = cam[1]
      return {
        p, c, marca: marcaRaiz,
        modelo: modeloCat ? { id: modeloCat.id, nome: modeloCat.nome.trim(), tipo: "EXISTENTE" } : casarModelo(marcaRaiz, c?.modelo ?? null),
        sistema: c?.sistema ?? "Não classificado",
      }
    }
    let marca = c?.marca ?? null
    let modelo = casarModelo(marca, c?.modelo ?? null)
    if (modelo.tipo === "SEM_MARCA" || modelo.tipo === "NOVO") {
      const pelaArvore = casarPelaArvore(p.nome, marca)
      if (pelaArvore) {
        marca = pelaArvore.marca
        modelo = { ...pelaArvore.modelo, tipo: "ARVORE" }
      }
    }
    return { p, c, marca, modelo, sistema: c?.sistema ?? "Não classificado" }
  })

  // 4) Nós Modelo > Sistema e corte por volume
  const chaveNo = (d: Destino) => `${d.marca}\u0001${d.modelo.id ?? `NOVO:${d.modelo.nome}`}\u0001${d.sistema}`
  const volumeNo = new Map<string, number>()
  for (const d of destinos) if (d.marca && d.modelo.tipo !== "SEM_MARCA") volumeNo.set(chaveNo(d), (volumeNo.get(chaveNo(d)) ?? 0) + 1)
  const criaSistema = (d: Destino) => d.sistema !== "Não classificado" && (volumeNo.get(chaveNo(d)) ?? 0) >= minimo

  // Planilhas
  const linhasModelos: (string | number | null)[][] = [["marca", "modelo_classificado", "produtos", "categoria_modelo_id", "categoria_modelo_nome", "tipo_match"]]
  const porModelo = new Map<string, { marca: string; modelo: string; n: number; m: Match }>()
  for (const d of destinos) {
    if (d.modelo.tipo === "EXISTENTE" || !d.marca || !d.c?.modelo) continue
    const k = `${d.marca}|${d.c.modelo}`
    const atual = porModelo.get(k) ?? { marca: d.marca, modelo: d.c.modelo, n: 0, m: d.modelo }
    atual.n++
    porModelo.set(k, atual)
  }
  for (const v of Array.from(porModelo.values()).sort((a, b) => b.n - a.n)) linhasModelos.push([nomeMarca(v.marca), v.modelo.toUpperCase(), v.n, v.m.id, v.m.nome, v.m.tipo])
  writeFileSync(join(dir, "modelos-de-para.csv"), csv(linhasModelos))

  const linhasNos: (string | number | null)[][] = [["marca", "raiz_id", "modelo_categoria_id", "modelo_nome", "sistema", "produtos", "acao"]]
  const nos = new Map<string, { d: Destino; n: number }>()
  for (const d of destinos) {
    if (!d.marca || d.modelo.tipo === "SEM_MARCA") continue
    const k = chaveNo(d)
    nos.set(k, { d: nos.get(k)?.d ?? d, n: (nos.get(k)?.n ?? 0) + 1 })
  }
  let nosCriar = 0
  for (const { d, n } of Array.from(nos.values()).sort((a, b) => (a.d.marca ?? "").localeCompare(b.d.marca ?? "") || a.d.modelo.nome.localeCompare(b.d.modelo.nome) || b.n - a.n)) {
    const cria = d.sistema !== "Não classificado" && n >= minimo
    if (cria) nosCriar++
    linhasNos.push([nomeMarca(d.marca ?? ""), raizDaMarca.get(d.marca ?? "") ?? "NOVA", d.modelo.id ?? "NOVO", d.modelo.nome, d.sistema, n, cria ? "CRIAR_SUBCATEGORIA" : "FICA_NO_MODELO"])
  }
  writeFileSync(join(dir, "taxonomia-proposta.csv"), csv(linhasNos))

  const linhasProd: (string | number | null)[][] = [["id", "codigo", "nome", "ativo", "principal_atual_id", "principal_atual", "nova_principal_proposta", "modelo_categoria_id", "tipo_match_modelo", "sistema", "categorias_atuais"]]
  const contTipo = new Map<string, number>()
  const contDestino = { sistema: 0, modelo: 0, revisar: 0 }
  for (const d of destinos) {
    const principal = d.p.categorias[0] ?? null
    let proposta: string | null = null
    if (d.marca && d.modelo.tipo !== "SEM_MARCA") {
      proposta = `${nomeMarca(d.marca)} > ${d.modelo.nome}${criaSistema(d) ? ` > ${d.sistema}` : ""}`
      if (criaSistema(d)) contDestino.sistema++
      else contDestino.modelo++
    } else contDestino.revisar++
    contTipo.set(d.modelo.tipo, (contTipo.get(d.modelo.tipo) ?? 0) + 1)
    linhasProd.push([
      d.p.id, d.p.codigo, d.p.nome, d.p.ativo ? "sim" : "não", principal, principal !== null ? caminho(principal).map((c) => c.nome.trim()).join(" > ") : null,
      proposta, d.modelo.id, d.modelo.tipo, d.sistema, d.p.categorias.join(","),
    ])
  }
  writeFileSync(join(dir, "atribuicao-produtos.csv"), csv(linhasProd))

  // Resumo
  const modelosNovos = new Set(destinos.filter((d) => d.modelo.tipo === "NOVO").map((d) => `${d.marca}|${d.modelo.nome}`))
  const marcasSemRaiz = new Set(destinos.filter((d) => d.marca && !raizDaMarca.has(d.marca)).map((d) => d.marca as string))
  const md: string[] = []
  md.push("# Proposta de reestruturação de categorias", "", "Gerada offline a partir da extração da API (somente leitura). Nada foi alterado na loja.", "")
  md.push(`- Produtos: ${fmt(produtos.length)} | corte para criar subcategoria de sistema: ${minimo} produtos`, "")
  md.push("## Item 2: renomear raízes", "", "| Nome atual | Nome proposto | Produtos |", "|---|---|---|")
  for (const r of resumoRen) md.push(`| ${r.atual} | ${r.novo} | ${fmt(r.n)} |`)
  md.push("", "Detalhe e casos para revisar em `renomear-raizes.csv`.", "")
  md.push("## Item 3: taxonomia Marca > Modelo > Sistema", "")
  md.push(`- Nós Modelo > Sistema com ≥ ${minimo} produtos (subcategorias a criar): ${fmt(nosCriar)}`)
  md.push(`- Modelos que não existem na árvore (categorias de modelo a criar): ${fmt(modelosNovos.size)}`)
  md.push(`- Marcas com produtos e sem raiz na árvore: ${marcasSemRaiz.size ? Array.from(marcasSemRaiz).map(nomeMarca).join(", ") : "nenhuma"}`, "")
  md.push("| Como o modelo foi resolvido | Produtos | % |", "|---|---|---|")
  const descTipo: Record<string, string> = {
    EXISTENTE: "Já está numa categoria de modelo da árvore",
    EXATO: "Casou com categoria de modelo de mesmo nome",
    ARVORE: "Nome do produto contém o nome de um modelo da árvore (marca vem da raiz)",
    CONTIDO: "Casou com categoria que contém o nome (ex.: CBR 1000 RR → CBR 1000 RR FIREBLADE): revisar",
    CONTEM: "Casou com categoria mais genérica (ex.: BIZ 125 EX → BIZ 125): revisar",
    NOVO: "Modelo sem categoria: criar",
    SEM_MARCA: "Sem marca/modelo identificados: revisão manual",
  }
  for (const [t, n] of Array.from(contTipo.entries()).sort((a, b) => b[1] - a[1])) md.push(`| ${descTipo[t] ?? t} | ${fmt(n)} | ${pct(n, produtos.length)} |`)
  md.push("", "## Item 4: nova categoria principal por produto", "")
  md.push(`- Vão para subcategoria de sistema: ${fmt(contDestino.sistema)} (${pct(contDestino.sistema, produtos.length)})`)
  md.push(`- Vão para a categoria do modelo (sistema abaixo do corte): ${fmt(contDestino.modelo)} (${pct(contDestino.modelo, produtos.length)})`)
  md.push(`- Revisão manual (sem marca/modelo): ${fmt(contDestino.revisar)} (${pct(contDestino.revisar, produtos.length)})`, "")
  md.push(
    "Recomendação de aplicação: trocar só a categoria principal (primeira da lista) e manter as categorias atuais como secundárias, inclusive Mercado Livre e \"Produtos novo/antigos\", para não quebrar integrações ou vitrines que dependam delas.",
    "",
    "## Limitações",
    "",
    "- Marca, modelo e sistema vêm do nome do produto (classificador heurístico). Casos CONTIDO/CONTEM/NOVO devem ser revisados antes de aplicar.",
    "- Raiz → marca pela maioria dos produtos; raízes com poucos produtos ficam como REVISAR.",
    "- Os nomes de modelo seguem a grafia atual da árvore; padronização de nomes (caixa, sufixos) é uma etapa à parte.",
    "",
  )
  writeFileSync(join(dir, "resumo-taxonomia.md"), md.join("\n"))
  console.log(`[taxonomia] gerado em ${dir}: renomear-raizes.csv, modelos-de-para.csv, taxonomia-proposta.csv, atribuicao-produtos.csv, resumo-taxonomia.md`)
}

function sum(m: Map<string, number>): number {
  let s = 0
  for (const v of m.values()) s += v
  return s
}

try {
  main()
} catch (e) {
  console.error("[taxonomia] Erro fatal:", e)
  process.exitCode = 1
}
