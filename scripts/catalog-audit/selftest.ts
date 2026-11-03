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

if (falhas) {
  console.error(`\n${falhas} teste(s) falharam`)
  process.exitCode = 1
} else {
  console.log("\nTodos os testes passaram")
}
