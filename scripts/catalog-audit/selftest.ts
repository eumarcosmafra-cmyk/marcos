/**
 * Testes offline (fixtures sintéticas). Rodar: npm run audit:catalogo:test
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { extrairCategoria, extrairProduto, fatiarJson } from "./extract"
import { Robots } from "./robots"
import { avaliarCategoria, avaliarProduto, chaveUrl, marcarDuplicados, niveisDeCategoria, type Contexto } from "./rules"
import { amostrar } from "./sitemap"
import { DicionarioModelos, classificarComMarca, classificarSemMarca, classificarSistema, detectarMarca, extrairModeloEAnos, tokenizar } from "./taxonomy"

const DIR = resolve(process.cwd(), "scripts/catalog-audit/fixtures")
const ler = (f: string) => readFileSync(resolve(DIR, f), "utf-8")
const BASE = "https://www.loja-exemplo.com.br"
const ctx: Contexto = { slugsCategorias: new Set(["honda", "ver-todos-honda", "cb-500", "cb-650-f"]), profundidadeMax: 4 }

let falhas = 0
function caso(nome: string, fn: () => void): void {
  try {
    fn()
    console.log(`ok   ${nome}`)
  } catch (e) {
    falhas++
    console.error(`FALHA ${nome}:`, e instanceof Error ? e.message : e)
  }
}
const regras = (achados: { regra: string }[]) => achados.map((a) => a.regra)

caso("produto em categoria técnica (caso Mercado Livre)", () => {
  const url = `${BASE}/painel-honda-cb-500-2015-usado`
  const d = extrairProduto(ler("produto-categoria-tecnica.html"), url, 200, url)
  assert.equal(d.categoriaPrincipalId, 999)
  assert.equal(d.categoriasPagina, "Mercado Livre")
  assert.equal(d.compatMarca, "HONDA")
  assert.equal(d.compatModelo, "CB 500")
  assert.equal(d.compatAnos, "2015, 2016")
  assert.deepEqual(d.breadcrumbPlataforma?.map((b) => b.id), [null, 999])
  const { achados, sugestao } = avaliarProduto(d, ctx)
  const r = regras(achados)
  for (const esperado of ["CATEGORIA_TECNICA", "CATEGORIA_SEM_URL", "CANONICAL_BARRA_DUPLA", "CONDICAO_DIVERGENTE", "SEM_H1_NO_HTML", "ARVORE_PLANA"]) {
    assert.ok(r.includes(esperado), `faltou ${esperado}; veio ${r.join(",")}`)
  }
  assert.ok(achados.find((a) => a.regra === "CATEGORIA_TECNICA")?.detalhe.includes("id=999"))
  assert.ok(!r.includes("JSONLD_DIVERGE_DA_PLATAFORMA"), "JSON-LD e plataforma concordam")
  assert.equal(sugestao.caminhoSugerido, "Home > Honda > Cb 500")
  assert.deepEqual(sugestao.categoriasExistentes, ["honda", "ver-todos-honda", "cb-500"])
})

caso("produto correto não gera alertas de estrutura", () => {
  const url = `${BASE}/painel-honda-cb-500-2015-usado`
  const d = extrairProduto(ler("produto-correto.html"), url, 200, url)
  assert.deepEqual(d.breadcrumbJsonLd?.map((b) => b.nome), ["Home", "Honda", "CB 500", "Painel Honda CB 500 2015 Usado"], "ordena por position e lê @graph")
  assert.equal(d.breadcrumbJsonLd?.[2].url, `${BASE}/honda-cb-500`, "item como objeto @id")
  const { achados } = avaliarProduto(d, ctx)
  assert.deepEqual(regras(achados), [], `não devia ter achados: ${regras(achados).join(",")}`)
})

caso("marca divergente, nível repetido e JSON-LD inválido", () => {
  const url = `${BASE}/painel-ducati-monster-696-usado`
  const d = extrairProduto(ler("produto-marca-errada.html"), url, 200, url)
  assert.equal(d.jsonLdInvalido, 1)
  const r = regras(avaliarProduto(d, ctx).achados)
  for (const esperado of ["MARCA_DIVERGENTE", "NIVEL_REPETIDO", "JSONLD_INVALIDO"]) assert.ok(r.includes(esperado), `faltou ${esperado}`)
})

caso("categoria: ItemList, paginação, nome genérico e H1 duplicado", () => {
  const url = `${BASE}/ver-todos-honda`
  const c = extrairCategoria(ler("categoria.html"), url, 200, url)
  assert.deepEqual(c.produtos, [`${BASE}//painel-honda-cb-500-2015-usado`, `${BASE}/farol-honda-cb-500`])
  assert.equal(c.proximaPagina, `${BASE}/ver-todos-honda?p=2`)
  const itens = [
    { dados: c, achados: avaliarCategoria(c, ctx) },
    { dados: { ...c, urlFinal: `${BASE}/ver-todos-yamaha` }, achados: [] },
  ]
  marcarDuplicados(itens)
  const r = regras(itens[0].achados)
  for (const esperado of ["NOME_GENERICO", "CATEGORIA_RAIZ", "H1_DUPLICADO"]) assert.ok(r.includes(esperado), `faltou ${esperado}; veio ${r.join(",")}`)
})

caso("raiz com nome de modelo em vez da marca (RAIZ_SEM_MARCA)", () => {
  const url = `${BASE}/painel-honda-cb-500-2015-usado`
  const d = extrairProduto(ler("produto-correto.html"), url, 200, url)
  assert.ok(d.breadcrumbJsonLd)
  d.breadcrumbJsonLd[1] = { nome: "BIZ 125 EX", url: `${BASE}/biz-125-ex` }
  const r = regras(avaliarProduto(d, ctx).achados)
  assert.deepEqual(r, ["RAIZ_SEM_MARCA"])
})

caso("condição: 'usado' só na descrição também conta", () => {
  const html = `<html><head><title>Painel CB 500</title><script type="application/ld+json">{"@type":"Product","name":"Painel CB 500","description":"Produto usado em perfeitas condições","itemCondition":"https://schema.org/NewCondition"}</script></head></html>`
  const url = `${BASE}/painel-cb-500`
  const d = extrairProduto(html, url, 200, url)
  assert.equal(d.mencionaUsado, true)
  assert.ok(regras(avaliarProduto(d, ctx).achados).includes("CONDICAO_DIVERGENTE"))
})

caso("niveisDeCategoria não remove categoria com nome curto que prefixa o produto", () => {
  const url = `${BASE}/painel-honda`
  const niveis = niveisDeCategoria([{ nome: "Home", url: `${BASE}/` }, { nome: "Painel", url: null }], url, "Painel Honda CB 500 2015 Usado")
  assert.deepEqual(niveis.map((n) => n.nome), ["Painel"])
})

caso("chaveUrl ignora barra dupla e barra final", () => {
  assert.equal(chaveUrl(`${BASE}//produto/`), chaveUrl(`${BASE}/produto`))
})

caso("robots.txt: curingas e regra mais longa", () => {
  const r = Robots.interpretar("User-agent: *\nDisallow: /checkout/\nDisallow: /*?*ordem=*\nAllow: /checkout/publico\n", "MPL-CatalogAudit")
  assert.equal(r.permitido(`${BASE}/checkout/pagar`), false)
  assert.equal(r.permitido(`${BASE}/checkout/publico`), true)
  assert.equal(r.permitido(`${BASE}/honda?ordem=preco`), false)
  assert.equal(r.permitido(`${BASE}/honda?p=2`), true)
})

caso("fatiarJson respeita colchetes dentro de strings", () => {
  const s = 'x = [{"a":"]"},{"b":[1,2]}]; resto'
  assert.equal(fatiarJson(s, s.indexOf("[")), '[{"a":"]"},{"b":[1,2]}]')
})

caso("amostra espalhada e determinística", () => {
  const itens = Array.from({ length: 100 }, (_, i) => i)
  assert.deepEqual(amostrar(itens, 4), [12, 37, 62, 87])
  assert.equal(amostrar(itens, 500).length, 100)
})

caso("slug com marca: tipo, sistema, modelo, anos, código", () => {
  const t = tokenizar("pinca-freio-dianteiro-honda-cbr-1000-rr-2008-2011-usado-original-00512345")
  const m = detectarMarca(t)
  assert.ok(m)
  const c = classificarComMarca("u", t, m)
  assert.deepEqual([c.tipoPeca, c.sistema, c.marca, c.modelo, c.anos, c.codigo], ["pinca freio dianteiro", "Freios", "honda", "cbr 1000 rr", "2008-2011", "00512345"])
})

caso("modelo: repetição, apelido colado, anos de 2 dígitos, truncado e 'c/ avaria'", () => {
  assert.deepEqual(extrairModeloEAnos(tokenizar("gsxr-750-srad-srad-750-11-13")), { modelo: ["gsxr", "750", "srad"], anos: "2011-2013", codigo: null })
  assert.deepEqual(extrairModeloEAnos(tokenizar("cb-650-f-cb650f-14-16")).modelo, ["cb", "650", "f"])
  assert.deepEqual(extrairModeloEAnos(tokenizar("multistrada-1200s-1200-s-10-14")).modelo, ["multistrada", "1200s"])
  assert.deepEqual(extrairModeloEAnos(tokenizar("r-1200-gs-r1200gs-13-1")), { modelo: ["r", "1200", "gs"], anos: "2013", codigo: null })
  assert.deepEqual(extrairModeloEAnos(tokenizar("r-1200-gs-r1200gs-13-16c-avaria")), { modelo: ["r", "1200", "gs"], anos: "2013-2016", codigo: null })
  assert.deepEqual(extrairModeloEAnos(tokenizar("mt-07-2018-2020")), { modelo: ["mt", "07"], anos: "2018-2020", codigo: null })
  assert.deepEqual(extrairModeloEAnos(tokenizar("ninja-300-14")), { modelo: ["ninja", "300"], anos: "2014", codigo: null })
})

caso("slug sem marca: infere pelo modelo, em qualquer ordem de palavras", () => {
  const d = new DicionarioModelos()
  for (let i = 0; i < 5; i++) d.registrar("yzf r1", "yamaha")
  for (let i = 0; i < 5; i++) d.registrar("f 800 gs", "bmw")
  const dic = d.consolidar(5)
  const a = classificarSemMarca("u", tokenizar("pinca-freio-dianteiro-f-800-gs-2009-2012-original-00515988"), dic)
  assert.deepEqual([a.tipoPeca, a.sistema, a.marca, a.modelo, a.anos, a.codigo, a.fonteMarca], ["pinca freio dianteiro", "Freios", "bmw", "f 800 gs", "2009-2012", "00515988", "modelo"])
  const b = classificarSemMarca("u", tokenizar("bico-injetor-r1-yzf-09-14"), dic)
  assert.deepEqual([b.marca, b.modelo, b.anos], ["yamaha", "yzf r1", "2009-2014"])
  const f = classificarSemMarca("u", tokenizar("sensor-oleo-multistrada-v4-rally-2024-2024-original"), dic, new Map([["multistrada", "ducati"]]))
  assert.deepEqual([f.tipoPeca, f.marca, f.modelo, f.anos, f.fonteMarca], ["sensor oleo", "ducati", "multistrada v4 rally", "2024", "familia"])
  const c = classificarSemMarca("u", tokenizar("pneu-dianteiro-120-70-17-maxxis"), dic)
  assert.deepEqual([c.marca, c.sistema], [null, "Rodas e Pneus"])
})

caso("sistema: qualificador decide o termo genérico", () => {
  assert.equal(classificarSistema("suporte farol"), "Iluminação")
  assert.equal(classificarSistema("tampa pinhao"), "Transmissão e Embreagem")
  assert.equal(classificarSistema("sensor map"), "Alimentação e Injeção")
  assert.equal(classificarSistema("kit parafuso carenagem"), "Carenagem e Acabamentos")
  assert.equal(classificarSistema("parafuso"), "Parafusos e Fixação")
  assert.equal(classificarSistema("disco embreagem"), "Transmissão e Embreagem")
  assert.equal(classificarSistema("xpto"), "Não classificado")
})

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam`)
  process.exitCode = 1
} else {
  console.log("\nTodos os testes passaram")
}
