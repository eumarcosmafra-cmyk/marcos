/**
 * Gera o simulador navegável (HTML único) a partir dos pilotos de marca.
 * Somente leitura: lê output/catalog-audit/piloto/<marca>/ e escreve output/catalog-audit/piloto/simulador.html.
 *
 * Uso: npm run audit:simulador -- --marcas dayun,kasinski [--corte 10]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { lerCsv } from "./csv"

const SEP = " > "
const caminho = (s: string) => (s ? s.split(SEP).map((x) => x.trim()).filter(Boolean) : [])

function main(): void {
  const { values } = parseArgs({ options: { marcas: { type: "string" }, corte: { type: "string" }, sufixo: { type: "string" } } })
  const marcas = (values.marcas ?? "").split(",").map((m) => m.trim().toLowerCase()).filter(Boolean)
  if (!marcas.length) throw new Error("Informe --marcas (ex.: dayun,kasinski)")
  // Sufixo dos arquivos do piloto: "filtro" (Sistema como filtro) ou "corte10" (Sistema como subcategoria)
  const sufixo = values.sufixo ?? (values.corte ? `corte${values.corte}` : "filtro")
  const arqPub = join("output", "catalog-audit", "site", "categorias-publicas.txt")
  const publicas = existsSync(arqPub) ? new Set(readFileSync(arqPub, "utf-8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) : new Set<string>()
  const base = join("output", "catalog-audit", "piloto")

  const dados = marcas.map((m) => {
    const dir = join(base, m.replace(/\s+/g, "-"))
    const ler = (arq: string) => {
      const f = join(dir, arq)
      if (!existsSync(f)) throw new Error(`Falta ${f}: rode antes "npm run audit:piloto -- --marca ${m}${sufixo === "filtro" ? " --sistema filtro" : ` --corte ${sufixo.replace("corte", "")}`}"`)
      return lerCsv(readFileSync(f, "utf-8"))
    }
    const produtos = ler(`produtos-${sufixo}.csv`).map((r) => ({
      c: r.codigo,
      n: r.nome,
      a: r.ativo === "sim" ? 1 : 0,
      ac: r.acao,
      an: caminho(r.categoria_principal_atual),
      dp: r.nova_categoria_principal ? caminho(r.nova_categoria_principal) : null,
      s: r.sistema === "Não classificado" ? "" : r.sistema,
      o: r.observacao,
      sec: r.categorias_atuais_manter_como_secundarias,
    }))
    const arvoreCsv = ler(`categorias-magazord-${sufixo}.csv`)
    const arvore = arvoreCsv.map((r) => [...caminho(r["Nome Pai"]), r.Nome.trim()])
    const mudancas = ler(`mudancas-${sufixo}.csv`).map((r) => ({ ac: r.acao, at: r.categoria_atual, nv: r.categoria_nova, n: r.produtos, m: r.motivo }))
    const duplicados = existsSync(join(dir, "duplicados.csv"))
      ? ler("duplicados.csv").map((r) => ({
          situacao: r.situacao,
          sugestao: r.sugestao,
          copia: { c: r.copia_codigo, n: r.copia_nome, a: r.copia_ativo === "sim", cat: r.copia_categorias, lan: r.copia_lancamento },
          original: { c: r.original_codigo, n: r.original_nome, a: r.original_ativo === "sim", cat: r.original_categoria_principal, lan: r.original_lancamento },
        }))
      : []
    const nome = arvore[0]?.[0] ?? m.toUpperCase()
    const paginas: Record<string, { slug: string; tipo: string; cliquesProd: number; impProd: number; cliquesPag: number; impPag: number }> = {}
    if (existsSync(join(dir, `modelos-paginas-${sufixo}.csv`))) {
      for (const r of ler(`modelos-paginas-${sufixo}.csv`)) {
        paginas[r.modelo] = {
          slug: r.pagina_publica.replace(/^\//, ""), tipo: r.situacao_pagina,
          cliquesProd: Number(r.cliques_produtos_6m) || 0, impProd: Number(r.impressoes_produtos_6m) || 0,
          cliquesPag: Number(r.cliques_pagina_modelo_6m) || 0, impPag: Number(r.impressoes_pagina_modelo_6m) || 0,
        }
      }
    }
    const slugNome = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const slugMarca = publicas.has(slugNome) ? slugNome : null
    return { id: m, nome, produtos, arvore, mudancas, duplicados, paginas, slugMarca }
  })

  const json = JSON.stringify({ geradoEm: new Date().toLocaleDateString("pt-BR"), marcas: dados })
    .replace(/</g, "\\u003c")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029")
  const modelo = readFileSync(join("scripts", "catalog-audit", "simulador.html"), "utf-8")
  if (!modelo.includes("__DADOS__")) throw new Error("Template sem o marcador __DADOS__")
  const saida = join(base, "simulador.html")
  writeFileSync(saida, modelo.replace("__DADOS__", () => json))
  console.log(`[simulador] ${dados.map((d) => `${d.nome} (${d.produtos.length})`).join(", ")} -> ${saida} (${Math.round(Buffer.byteLength(json) / 1024)} KB de dados)`)
}

try {
  main()
} catch (e) {
  console.error("[simulador] Erro fatal:", e)
  process.exitCode = 1
}
