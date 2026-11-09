/**
 * Gera o simulador navegável com a recategorização completa (todas as marcas), a partir da consolidação.
 * Somente leitura e offline: lê output/catalog-audit/recategorizacao/ (+ pilotos, duplicados, páginas públicas)
 * e escreve output/catalog-audit/piloto/simulador.html + piloto/dados/<marca>.json (um arquivo por marca,
 * carregado pela página só quando a marca é escolhida).
 *
 * Uso: npm run audit:simulador-completo [-- --sufixo corte10]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"

const SEP = " > "
const LIMITE_ARQUIVO = 15 * 1024 * 1024
const ACOES = ["RECATEGORIZAR", "AJUSTAR_PRINCIPAL", "DUPLICADO", "REVISAR_SEM_MODELO"]
const caminho = (s: string) => (s ? s.split(SEP).map((x) => x.trim()).filter(Boolean) : [])
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const seguro = (json: string) =>
  json.replace(/</g, "\\u003c").replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028").replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029")

/** Dicionário de valores repetidos: cada valor vira um índice no arquivo da marca. */
class Dic {
  readonly valores: string[] = []
  private readonly idx: Record<string, number> = {}
  of(v: string): number {
    if (!v) return -1
    if (!(v in this.idx)) {
      this.idx[v] = this.valores.length
      this.valores.push(v)
    }
    return this.idx[v]
  }
}

function main(): void {
  const { values } = parseArgs({ options: { sufixo: { type: "string" } } })
  const sufixo = values.sufixo ?? "corte10"
  const raiz = join("output", "catalog-audit")
  const rec = join(raiz, "recategorizacao")
  const ler = (arq: string) => {
    if (!existsSync(arq)) throw new Error(`Falta ${arq}: rode antes "npm run audit:consolidar"`)
    return lerCsv(readFileSync(arq, "utf-8"))
  }
  const agrupar = <T extends Record<string, string>>(linhas: T[], chave: (r: T) => string) => {
    const g: Record<string, T[]> = {}
    for (const r of linhas) (g[chave(r)] ??= []).push(r)
    return g
  }

  const produtos = agrupar(ler(join(rec, "produtos-recategorizacao.csv")), (r) => r.marca)
  const mudancas = agrupar(ler(join(rec, "mudancas-completo.csv")), (r) => r.marca)
  const arvore = agrupar(ler(join(rec, "categorias-magazord-completo.csv")), (r) => caminho(r["Nome Pai"])[0] ?? r.Nome.trim())
  const seo = agrupar(ler(join(rec, "seo-categorias.csv")), (r) => caminho(r.categoria)[0])
  const duplicados = agrupar(existsSync(join(raiz, "api", "duplicados.csv")) ? ler(join(raiz, "api", "duplicados.csv")) : [], (r) => r.marca)
  const decisoes = ler(join(rec, "decisoes-de-modelo.csv"))
  const semMarca = ler(join(rec, "pendencias-sem-marca-de-moto.csv"))
  const arqPub = join(raiz, "site", "categorias-publicas.txt")
  const publicas = new Set(existsSync(arqPub) ? readFileSync(arqPub, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [])

  const base = join(raiz, "piloto")
  const dirDados = join(base, "dados")
  rmSync(dirDados, { recursive: true, force: true })
  mkdirSync(dirDados, { recursive: true })

  const nomes = Object.keys(produtos).sort((a, b) => produtos[b].length - produtos[a].length)
  const indice = nomes.map((nome) => {
    const id = slug(nome)
    const cam = new Dic()
    const sis = new Dic()
    const obs = new Dic()
    const sec = new Dic()
    const conta: Record<string, number> = {}
    const p = produtos[nome].map((r) => {
      conta[r.acao] = (conta[r.acao] ?? 0) + 1
      const ac = ACOES.indexOf(r.acao)
      if (ac < 0) throw new Error(`Ação desconhecida "${r.acao}" no produto ${r.codigo}`)
      return [
        r.codigo,
        Number(r.id) || 0,
        r.nome,
        ac,
        cam.of(caminho(r.categoria_principal_atual).join(SEP)),
        cam.of(caminho(r.nova_categoria_principal).join(SEP)),
        r.ativo === "sim" ? 1 : 0,
        sis.of(r.sistema === "Não classificado" ? "" : r.sistema),
        obs.of(r.observacao),
        sec.of(r.categorias_atuais_manter_como_secundarias),
      ]
    })
    if (!arvore[nome]) console.warn(`[simulador-completo] Aviso: ${nome} sem árvore proposta (raiz com outro nome?)`)
    const dirPiloto = join(base, id)
    const arqPag = join(dirPiloto, `modelos-paginas-${sufixo}.csv`)
    const paginas: Record<string, { slug: string; tipo: string; cliquesProd: number; impProd: number; cliquesPag: number; impPag: number }> = {}
    if (existsSync(arqPag)) {
      for (const r of lerCsv(readFileSync(arqPag, "utf-8"))) {
        paginas[r.modelo] = {
          slug: r.pagina_publica.replace(/^\//, ""), tipo: r.situacao_pagina,
          cliquesProd: Number(r.cliques_produtos_6m) || 0, impProd: Number(r.impressoes_produtos_6m) || 0,
          cliquesPag: Number(r.cliques_pagina_modelo_6m) || 0, impPag: Number(r.impressoes_pagina_modelo_6m) || 0,
        }
      }
    } else console.warn(`[simulador-completo] Aviso: falta ${arqPag} (sem demanda por modelo)`)
    const seoMarca: Record<string, { h1: string; t: string; md: string; pg: string; sit: string }> = {}
    for (const r of seo[nome] ?? []) seoMarca[caminho(r.categoria).join(SEP)] = { h1: r.h1_sugerido, t: r.titulo_sugerido, md: r.meta_description_sugerida, pg: r.pagina_publica, sit: r.situacao_pagina }
    const dups = (duplicados[nome] ?? []).map((r) => ({
      situacao: r.situacao,
      sugestao: r.sugestao,
      copia: { c: r.copia_codigo, n: r.copia_nome, a: r.copia_ativo === "sim", cat: r.copia_categorias, lan: r.copia_lancamento },
      original: { c: r.original_codigo, n: r.original_nome, a: r.original_ativo === "sim", cat: r.original_categoria_principal, lan: r.original_lancamento },
    }))
    const muds = (mudancas[nome] ?? []).map((r) => ({ ac: r.acao, at: r.categoria_atual, nv: r.categoria_nova, n: r.produtos, m: r.motivo, id: r.id_categoria_atual }))
    const slugMarca = publicas.has(id) ? id : null
    const dados = {
      dic: { cam: cam.valores.map(caminho), sis: sis.valores, obs: obs.valores, sec: sec.valores },
      p,
      arvore: (arvore[nome] ?? []).map((r) => [...caminho(r["Nome Pai"]), r.Nome.trim()]),
      mudancas: muds,
      duplicados: dups,
      paginas,
      seo: seoMarca,
      slugMarca,
    }
    const json = JSON.stringify(dados)
    const bytes = Buffer.byteLength(json)
    if (bytes > LIMITE_ARQUIVO) throw new Error(`${nome}: arquivo de dados com ${Math.round(bytes / 1048576)} MB passa do limite de 15 MB`)
    const arquivo = `dados/${id}.json`
    writeFileSync(join(base, arquivo), json)
    const nivel = (n: string) => (seo[nome] ?? []).filter((r) => r.nivel === n).length
    const pags = Object.values(paginas)
    const raizMud = muds.find((x) => x.ac === "RENOMEAR_RAIZ")
    return {
      id, nome, total: p.length, arquivo, kb: Math.round(bytes / 1024),
      resumo: {
        ml: conta.RECATEGORIZAR ?? 0, gen: conta.AJUSTAR_PRINCIPAL ?? 0, dup: conta.DUPLICADO ?? 0, rev: conta.REVISAR_SEM_MODELO ?? 0,
        modelos: nivel("modelo"), subcats: nivel("subcategoria"),
        pagExiste: pags.filter((x) => x.tipo && x.tipo !== "CRIAR").length, pagCriar: pags.filter((x) => x.tipo === "CRIAR").length,
        cliques: pags.reduce((s, x) => s + x.cliquesProd, 0),
        raiz: raizMud ? `renomear (${raizMud.at} → ${raizMud.nv})` : muds.some((x) => x.ac === "CRIAR" && !x.nv.includes(SEP)) ? "criar" : "mantém",
      },
    }
  })

  const D = {
    geradoEm: new Date().toLocaleDateString("pt-BR"),
    completo: true,
    marcas: indice,
    decisoes: decisoes.map((r) => ({ marca: r.marca, dec: r.decisao, at: r.modelo_atual, nv: r.fica_como, n: r.produtos, m: r.motivo })),
    semMarca: semMarca.map((r) => ({ c: r.codigo, id: r.id, n: r.nome, a: r.ativo === "sim", marca: r.marca_cadastrada })),
  }
  const json = seguro(JSON.stringify(D))
  const modelo = readFileSync(join("scripts", "catalog-audit", "simulador.html"), "utf-8")
  if (!modelo.includes("__DADOS__")) throw new Error("Template sem o marcador __DADOS__")
  const saida = join(base, "simulador.html")
  writeFileSync(saida, modelo.replace("__DADOS__", () => json))
  const totalKb = indice.reduce((s, m) => s + m.kb, 0)
  console.log(`[simulador-completo] ${indice.length} marcas, ${indice.reduce((s, m) => s + m.total, 0).toLocaleString("pt-BR")} produtos -> ${saida} (${Math.round(Buffer.byteLength(json) / 1024)} KB) + ${dirDados} (${(totalKb / 1024).toFixed(1)} MB; maior: ${indice[0].nome} ${(indice[0].kb / 1024).toFixed(1)} MB)`)
}

try {
  main()
} catch (e) {
  console.error("[simulador-completo] Erro fatal:", e)
  process.exitCode = 1
}
