/**
 * Piloto de recategorização de UMA marca, no formato do template de categorias da Magazord.
 * Somente leitura e offline: usa os arquivos de `audit:api`, `audit:taxonomia` e a exportação
 * de categorias da Magazord (Nome;"Nome Pai";Tipo;Ordem;Filtro).
 *
 * Saídas em output/catalog-audit/piloto/<marca>/:
 *   categorias-magazord-corte<N>.csv  árvore final da marca no formato de importação da Magazord
 *   mudancas.csv                      o que muda na árvore atual (manter, criar, fundir, desativar, revisar)
 *   produtos.csv                      nova categoria principal por produto (+ duplicados e casos a revisar)
 *   auditoria.md                      resumo para revisão
 *
 * Uso: npm run audit:piloto -- --marca dayun [--corte 50] [--export caminho/categorias-export-magazord.csv]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import type { CategoriaMagazord, ProdutoMagazord } from "./magazord"
import { tokenizar } from "./taxonomy"

const CATEGORIA_TECNICA = 10095
const SEM_SISTEMA = "Não classificado"

/** Parser de CSV com ; e aspas (formato das planilhas geradas e da exportação Magazord). */
function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = []
  let campo = ""
  let linha: string[] = []
  let aspas = false
  const t = texto.replace(/^﻿/, "")
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === ";") {
      linha.push(campo)
      campo = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ""
    } else campo += c
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  const [cab, ...resto] = linhas
  return resto.filter((l) => l.some((x) => x !== "")).map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])))
}

/** Mesmo estilo da exportação Magazord: UTF-8 sem BOM, LF, aspas só quando há espaço, ; ou aspas. */
function csvMagazord(linhas: string[][]): string {
  const cel = (s: string) => (/[\s;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return linhas.map((l) => l.map(cel).join(";")).join("\n") + "\n"
}
function csvExcel(linhas: (string | number | null)[][]): string {
  const cel = (v: string | number | null) => {
    const s = v === null ? "" : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return "﻿" + linhas.map((l) => l.map(cel).join(";")).join("\r\n") + "\r\n"
}
const fmt = (n: number) => n.toLocaleString("pt-BR")
const norm = (s: string) => tokenizar(s).join(" ")
/** Chave compacta de modelo: sem espaços/hífens e sem o que está entre parênteses ("DY150ZH (TRICICLO CARGA)" = "DY 150 ZH"). */
const compacta = (s: string) => tokenizar(s.replace(/\([^)]*\)/g, " ")).join("")
const TRIM = /\s+(ABS|SE|DLX)$/i

function main(): void {
  const { values } = parseArgs({ options: { marca: { type: "string" }, corte: { type: "string" }, dir: { type: "string" }, export: { type: "string" }, fusoes: { type: "string" } } })
  if (!values.marca) throw new Error("Informe --marca (ex.: dayun)")
  const marcaAlvo = norm(values.marca)
  const corte = Number(values.corte ?? 50)
  const dir = values.dir ?? join("output", "catalog-audit", "api")
  const saida = join("output", "catalog-audit", "piloto", marcaAlvo.replace(/\s+/g, "-"))
  mkdirSync(saida, { recursive: true })

  const categorias = JSON.parse(readFileSync(join(dir, "categorias.json"), "utf-8")) as CategoriaMagazord[]
  const porId = new Map(categorias.map((c) => [c.id, c]))
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
  const nomeCaminho = (id: number) => caminho(id).map((c) => c.nome.trim()).join(" > ")
  const marcasApi = new Map((JSON.parse(readFileSync(join(dir, "marcas.json"), "utf-8")) as { id: number; nome: string }[]).map((m) => [m.id, norm(m.nome)]))
  const produtos = new Map<number, ProdutoMagazord>()
  for (const l of readFileSync(join(dir, "produtos.jsonl"), "utf-8").split("\n")) if (l) {
    const p = JSON.parse(l) as ProdutoMagazord
    produtos.set(p.id, p)
  }
  const atrib = new Map(lerCsv(readFileSync(join(dir, "atribuicao-produtos.csv"), "utf-8")).map((r) => [Number(r.id), r]))

  // Raiz da marca na árvore atual (pela exportação Magazord, se informada; senão pelo nome na API)
  const raizes = categorias.filter((c) => c.pai === null)
  const raizPorNome = raizes.find((r) => norm(r.nome) === marcaAlvo)
  const raizPorProposta = (() => {
    const ids = new Map<number, number>()
    for (const r of atrib.values()) {
      if (!norm(r.nova_principal_proposta.split(" > ")[0] ?? "").startsWith(marcaAlvo)) continue
      const m = Number(r.modelo_categoria_id)
      const raiz = Number.isFinite(m) && porId.has(m) ? caminho(m)[0]?.id : undefined
      if (raiz !== undefined) ids.set(raiz, (ids.get(raiz) ?? 0) + 1)
    }
    return Array.from(ids.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  })()
  const raiz = raizPorNome ?? (raizPorProposta !== undefined ? porId.get(raizPorProposta) : undefined)
  const nomeRaiz = raiz ? raiz.nome.trim() : values.marca.toUpperCase()

  // Conferência com a exportação Magazord (nomes exatos usados pela plataforma)
  const exportacao = values.export ? lerCsv(readFileSync(values.export, "utf-8")) : []
  const caminhosExport = new Set(exportacao.map((r) => [r["Nome Pai"].trim(), r.Nome.trim()].filter(Boolean).join(" > ")))

  // Produtos da marca: marca cadastrada na API ou marca proposta pelo classificador
  const daMarca = Array.from(produtos.values()).filter((p) => {
    const r = atrib.get(p.id)
    return (p.marca !== null && marcasApi.get(p.marca) === marcaAlvo) || (r !== undefined && norm(r.nova_principal_proposta.split(" > ")[0] ?? "") === marcaAlvo)
  })

  // Duplicados: cópia com código sem zero à esquerda, cujo original está na árvore
  const porCodigo = new Map<string, ProdutoMagazord[]>()
  for (const p of produtos.values()) {
    const m = /^0*(\d+)([A-Z]*)$/.exec((p.codigo ?? "").trim())
    if (m) porCodigo.set(m[1] + m[2], [...(porCodigo.get(m[1] + m[2]) ?? []), p])
  }
  const gemeoNaArvore = (p: ProdutoMagazord): ProdutoMagazord | null => {
    const m = /^0*(\d+)([A-Z]*)$/.exec((p.codigo ?? "").trim())
    if (!m || p.categorias[0] !== CATEGORIA_TECNICA) return null
    return (porCodigo.get(m[1] + m[2]) ?? []).find((q) => q.id !== p.id && q.categorias[0] !== CATEGORIA_TECNICA) ?? null
  }

  // Modelos atuais da raiz (nível 2) e regra 1: fundir variações de grafia e de equipamento (ABS/SE/DLX)
  const modelosAtuais = raiz ? categorias.filter((c) => c.pai === raiz.id) : []
  const nivel3 = new Set(categorias.filter((c) => c.pai !== null && modelosAtuais.some((m) => m.id === c.pai)).map((c) => c.id))
  const modeloDeProduto = (p: ProdutoMagazord): { nome: string | null; idAtual: number | null } => {
    const naArvore = p.categorias.filter((c) => porId.has(c) && caminho(c)[0]?.id === raiz?.id && caminho(c).length >= 2)
    if (naArvore.length) {
      const m = caminho(naArvore[0])[1]
      return { nome: m.nome.trim(), idAtual: m.id }
    }
    const r = atrib.get(p.id)
    const id = Number(r?.modelo_categoria_id)
    const partes = (r?.nova_principal_proposta ?? "").split(" > ")
    if (Number.isFinite(id) && porId.has(id)) return { nome: porId.get(id)?.nome.trim() ?? null, idAtual: id }
    return { nome: partes[1] ?? null, idAtual: null }
  }

  interface Linha { p: ProdutoMagazord; modelo: string | null; modeloOriginal: string | null; modeloIdAtual: number | null; sistema: string; acao: string; obs: string; gemeo: ProdutoMagazord | null }
  const linhas: Linha[] = daMarca.map((p) => {
    const gemeo = gemeoNaArvore(p)
    const fonte = gemeo ?? p
    const { nome, idAtual } = modeloDeProduto(fonte)
    const sistema = atrib.get(fonte.id)?.sistema || atrib.get(p.id)?.sistema || SEM_SISTEMA
    let acao = "RECATEGORIZAR"
    let obs = ""
    if (gemeo) {
      acao = "DUPLICADO"
      obs = `Cópia de ${gemeo.codigo} (id ${gemeo.id}, "${gemeo.nome.slice(0, 60)}"). Decidir: desativar a cópia ou unificar.`
    } else if (!nome || /^[\d\s.]+$/.test(nome)) {
      acao = "REVISAR_SEM_MODELO"
      obs = nome ? `Modelo inválido ("${nome}")` : "Nome do produto não traz o modelo"
    } else if (p.categorias[0] !== CATEGORIA_TECNICA && caminho(p.categorias[0] ?? -1)[0]?.id === raiz?.id) acao = "AJUSTAR_PRINCIPAL"
    const modelo = acao === "REVISAR_SEM_MODELO" ? null : nome
    return { p, modelo, modeloOriginal: modelo, modeloIdAtual: idAtual, sistema, acao, obs, gemeo }
  })

  // Fusões (regra 1): mesma chave compacta, ou sufixo ABS/SE/DLX
  const volumeModelo = new Map<string, number>()
  for (const l of linhas) if (l.modelo) volumeModelo.set(l.modelo, (volumeModelo.get(l.modelo) ?? 0) + 1)
  const nomesConhecidos = Array.from(new Set([...modelosAtuais.map((m) => m.nome.trim()), ...volumeModelo.keys()]))
  const canonico = new Map<string, string>()
  const grupos = new Map<string, string[]>()
  for (const n of nomesConhecidos) {
    const base = n.replace(TRIM, "")
    const chave = compacta(base)
    grupos.set(chave, [...(grupos.get(chave) ?? []), n])
  }
  for (const nomes of grupos.values()) {
    const atuais = nomes.filter((n) => modelosAtuais.some((m) => m.nome.trim() === n))
    const escolha = [...(atuais.length ? atuais : nomes)].sort((a, b) => (volumeModelo.get(b) ?? 0) - (volumeModelo.get(a) ?? 0) || a.length - b.length)[0]
    for (const n of nomes) canonico.set(n, escolha)
  }
  for (const l of linhas) if (l.modelo) l.modelo = canonico.get(l.modelo) ?? l.modelo

  // Fusões decididas por pessoa (ex.: nome canônico pela tabela FIPE): arquivo de;para;obs
  const fusoesManuais = new Map<string, { para: string; obs: string }>()
  if (values.fusoes) {
    for (const r of lerCsv(readFileSync(values.fusoes, "utf-8"))) if (r.de && r.para) fusoesManuais.set(r.de.trim(), { para: r.para.trim(), obs: (r.obs ?? "").trim() })
  }
  for (const [de, f] of fusoesManuais) {
    for (const [n, c] of canonico) if (c === de || n === de) canonico.set(n, f.para)
    canonico.set(de, f.para)
  }
  for (const l of linhas) {
    const f = l.modelo ? fusoesManuais.get(l.modelo) : undefined
    if (f && l.modelo) {
      if (f.obs) l.obs = [l.obs, `Modelo "${l.modelo}" fundido em "${f.para}": ${f.obs}`].filter(Boolean).join(" | ")
      l.modelo = f.para
    }
  }

  // Sem modelo: sugere pelo lote de desmontagem (códigos vizinhos ±5 da mesma marca, todos do mesmo modelo)
  const numCodigo = (c: string) => {
    const m = /^0*(\d+)[A-Z]*$/.exec((c ?? "").trim())
    return m ? Number(m[1]) : null
  }
  const modeloPorCodigo = new Map<number, string>()
  for (const l of linhas) {
    const n = numCodigo(l.p.codigo)
    if (n !== null && l.modelo) modeloPorCodigo.set(n, l.modelo)
    const g = l.gemeo ? numCodigo(l.gemeo.codigo) : null
    if (g !== null && l.modelo) modeloPorCodigo.set(g, l.modelo)
  }
  for (const l of linhas) {
    if (l.acao !== "REVISAR_SEM_MODELO") continue
    const n = numCodigo(l.p.codigo)
    if (n === null) continue
    const vizinhos: string[] = []
    for (let d = -5; d <= 5; d++) {
      const m = d !== 0 ? modeloPorCodigo.get(n + d) : undefined
      if (m) vizinhos.push(m)
    }
    const unicos = new Set(vizinhos)
    if (vizinhos.length >= 2 && unicos.size === 1) l.obs = `Sugestão por lote: ${vizinhos[0]} (${vizinhos.length} códigos vizinhos são desse modelo). Confirmar.`
  }

  // Possíveis fusões que exigem decisão humana: um nome é prefixo do outro ("DY150-7" × "DY150-7 PHANTON")
  const finais = Array.from(new Set(linhas.map((l) => l.modelo).filter((x): x is string => !!x)))
  const revisarFusao: [string, string][] = []
  // (a) palavras de A são o começo de B: "DY150-7" × "DY150-7 PHANTON"
  // (b) mesmo código sem o prefixo de letras: "DY125T-10" × "125 T 10 SPACE"
  const assinatura = (s: string) => compacta(s).replace(/^[a-z]+/, "")
  for (const a of finais) {
    for (const b of finais) {
      if (a === b) continue
      const pa = a.split(/\s+/)
      const pb = b.split(/\s+/)
      const prefixo = pa.length < pb.length && pa.every((x, i) => x === pb[i])
      const sa = assinatura(a)
      const mesmaAssinatura = sa.length >= 4 && assinatura(b).startsWith(sa) && compacta(b) !== compacta(a) && !prefixo && !compacta(b).startsWith(compacta(a))
      if (prefixo || mesmaAssinatura) revisarFusao.push([a, b])
    }
  }
  // modelos atuais sem produtos que parecem versão curta de um modelo final ("DY150-9" × "DY150-9 SUPER GIANT")
  for (const m of modelosAtuais) {
    const a = m.nome.trim()
    if (finais.includes(a)) continue
    for (const b of finais) if (b.split(/\s+/)[0] === a && b !== a) revisarFusao.push([a, b])
  }

  // Sistema: subcategoria só se o nó Modelo > Sistema atingir o corte
  const volNo = new Map<string, number>()
  for (const l of linhas) if (l.modelo && l.sistema !== SEM_SISTEMA) volNo.set(`${l.modelo}|${l.sistema}`, (volNo.get(`${l.modelo}|${l.sistema}`) ?? 0) + 1)
  const destino = (l: Linha) => (l.modelo ? [nomeRaiz, l.modelo, ...((volNo.get(`${l.modelo}|${l.sistema}`) ?? 0) >= corte ? [l.sistema] : [])].join(" > ") : null)

  // 1) Árvore final no formato Magazord
  const arvore: string[][] = [["Nome", "Nome Pai", "Tipo", "Ordem", "Filtro"], [nomeRaiz, "", "Produto", "", "1"]]
  const modelosFinais = Array.from(new Set(linhas.filter((l) => l.acao !== "REVISAR_SEM_MODELO").map((l) => l.modelo).filter((x): x is string => !!x))).sort()
  for (const m of modelosFinais) {
    arvore.push([m, nomeRaiz, "Produto", "", "1"])
    const sistemas = Array.from(new Set(linhas.filter((l) => l.modelo === m && (volNo.get(`${m}|${l.sistema}`) ?? 0) >= corte).map((l) => l.sistema))).sort()
    for (const s of sistemas) arvore.push([s, `${nomeRaiz} > ${m}`, "Produto", "", "1"])
  }
  writeFileSync(join(saida, `categorias-magazord-corte${corte}.csv`), csvMagazord(arvore))

  // 2) Mudanças na árvore atual
  const mud: (string | number | null)[][] = [["acao", "categoria_atual", "categoria_nova", "produtos", "motivo"]]
  const usadosAtuais = new Set(linhas.map((l) => l.modelo))
  for (const m of modelosAtuais) {
    const nome = m.nome.trim()
    const destinoNome = canonico.get(nome) ?? nome
    const n = linhas.filter((l) => l.modelo === destinoNome).length
    if (norm(nome) === marcaAlvo) mud.push(["DESATIVAR", `${nomeRaiz} > ${nome}`, null, 0, "Modelo com o nome da própria marca"])
    else if (destinoNome !== nome) {
      const manual = fusoesManuais.get(nome)
      const motivo = manual ? `Fusão confirmada (nome canônico FIPE)${manual.obs ? `: ${manual.obs}` : ""}` : "Mesmo modelo: variação de grafia ou de equipamento (regra 1)"
      mud.push(["FUNDIR", `${nomeRaiz} > ${nome}`, `${nomeRaiz} > ${destinoNome}`, linhas.filter((l) => l.modeloOriginal === nome).length, motivo])
    }
    else if (!usadosAtuais.has(nome)) mud.push(["DESATIVAR", `${nomeRaiz} > ${nome}`, null, 0, "Modelo sem produtos"])
    else mud.push(["MANTER", `${nomeRaiz} > ${nome}`, `${nomeRaiz} > ${nome}`, n, ""])
  }
  for (const m of modelosFinais) if (!modelosAtuais.some((x) => x.nome.trim() === m)) mud.push(["CRIAR", null, `${nomeRaiz} > ${m}`, linhas.filter((l) => l.modelo === m).length, "Modelo com produtos e sem categoria"])
  for (const id of nivel3) mud.push(["DESATIVAR", nomeCaminho(id), null, null, "Grupo genérico do 3º nível substituído pela estrutura nova"])
  for (const r of arvore.slice(2)) if (r[1].includes(" > ")) mud.push(["CRIAR", null, `${r[1]} > ${r[0]}`, volNo.get(`${r[1].split(" > ")[1]}|${r[0]}`) ?? null, `Subcategoria de sistema (≥ ${corte} produtos)`])
  for (const [a, b] of revisarFusao) mud.push(["REVISAR_FUSAO", `${nomeRaiz} > ${b}`, `${nomeRaiz} > ${a}`, volumeModelo.get(b) ?? null, "Nome contém outro modelo: confirmar se é a mesma moto"])
  if (raiz && !caminhosExport.size) mud.push(["INFO", null, null, null, "Exportação Magazord não informada: nomes não conferidos"])
  else if (raiz && !caminhosExport.has(nomeRaiz)) mud.push(["INFO", nomeRaiz, null, null, "Raiz não encontrada na exportação Magazord"])
  writeFileSync(join(saida, `mudancas-corte${corte}.csv`), csvExcel(mud))

  // 3) Produtos
  const prod: (string | number | null)[][] = [["codigo", "id", "nome", "ativo", "acao", "categoria_principal_atual", "nova_categoria_principal", "categorias_atuais_manter_como_secundarias", "sistema", "observacao"]]
  const ordemAcao: Record<string, number> = { RECATEGORIZAR: 0, AJUSTAR_PRINCIPAL: 1, DUPLICADO: 2, REVISAR_SEM_MODELO: 3 }
  for (const l of linhas.sort((a, b) => (ordemAcao[a.acao] ?? 9) - (ordemAcao[b.acao] ?? 9) || (a.modelo ?? "").localeCompare(b.modelo ?? ""))) {
    const principal = l.p.categorias[0]
    prod.push([
      l.p.codigo, l.p.id, l.p.nome, l.p.ativo ? "sim" : "não", l.acao,
      principal !== undefined ? nomeCaminho(principal) : null,
      l.acao === "REVISAR_SEM_MODELO" ? null : destino(l),
      l.p.categorias.map(nomeCaminho).join(" | "), l.sistema, l.obs,
    ])
  }
  writeFileSync(join(saida, `produtos-corte${corte}.csv`), csvExcel(prod))

  // 4) Auditoria
  const cont = new Map<string, number>()
  for (const l of linhas) cont.set(l.acao, (cont.get(l.acao) ?? 0) + 1)
  const contMud = new Map<string, number>()
  for (const r of mud.slice(1)) contMud.set(String(r[0]), (contMud.get(String(r[0])) ?? 0) + 1)
  const md: string[] = []
  md.push(`# Piloto de recategorização: ${nomeRaiz}`, "", "Somente leitura. Nada foi alterado na loja.", "")
  md.push(`- Produtos da marca: ${fmt(linhas.length)} (ativos: ${fmt(linhas.filter((l) => l.p.ativo).length)})`)
  md.push(`- Raiz atual: ${raiz ? `${nomeRaiz} (id ${raiz.id})` : "não existe: criar"}`)
  md.push(`- Corte para subcategoria de sistema: ${corte} produtos`, "")
  md.push("## Produtos", "", "| Ação | Produtos | O que significa |", "|---|---|---|")
  const desc: Record<string, string> = {
    RECATEGORIZAR: "Principal hoje é \"Mercado Livre\": passa para a categoria do modelo",
    AJUSTAR_PRINCIPAL: "Já está na árvore: principal sai do grupo genérico (3º nível) para a estrutura nova",
    DUPLICADO: "Cópia de um produto que já existe na árvore (código sem zero à esquerda)",
    REVISAR_SEM_MODELO: "Nome não traz o modelo: definir manualmente",
  }
  for (const [a, n] of Array.from(cont.entries()).sort((x, y) => (ordemAcao[x[0]] ?? 9) - (ordemAcao[y[0]] ?? 9))) md.push(`| ${a} | ${fmt(n)} | ${desc[a] ?? ""} |`)
  md.push("", "## Árvore", "", `Arquivo \`categorias-magazord-corte${corte}.csv\` (formato de importação Magazord): ${arvore.length - 1} categorias.`, "")
  md.push("| Ação na árvore atual | Itens |", "|---|---|")
  for (const [a, n] of contMud) md.push(`| ${a} | ${fmt(n)} |`)
  md.push("", "### Modelos finais", "", "| Modelo | Produtos | Observação |", "|---|---|---|")
  for (const m of modelosFinais) {
    const n = linhas.filter((l) => l.modelo === m).length
    md.push(`| ${m} | ${fmt(n)} | ${n < 5 ? "Página fina (< 5 produtos): manter a categoria, avaliar noindex" : ""} |`)
  }
  if (revisarFusao.length) {
    md.push("", "### Possíveis fusões para confirmar", "")
    for (const [a, b] of revisarFusao) md.push(`- "${b}" é o mesmo modelo que "${a}"?`)
  }
  md.push("", "## Como aplicar", "", `1. Revisar \`mudancas-corte${corte}.csv\` e as fusões acima.`, `2. Enviar \`categorias-magazord-corte${corte}.csv\` à Magazord para criar/ajustar a árvore.`, `3. Aplicar \`produtos-corte${corte}.csv\`: trocar só a categoria principal; manter as atuais como secundárias.`, "4. Decidir os DUPLICADOS antes de recategorizar as cópias.", "")
  writeFileSync(join(saida, `auditoria-corte${corte}.md`), md.join("\n"))
  console.log(`[piloto] ${nomeRaiz}: ${linhas.length} produtos -> ${saida}`)
}

try {
  main()
} catch (e) {
  console.error("[piloto] Erro fatal:", e)
  process.exitCode = 1
}
