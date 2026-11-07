// Validação no navegador da tela de Pautas: lista → pauta → buscar fontes → aprovar → (opcional) produzir.
// "Buscar fontes" faz 1 chamada ao modelo. "Produzir" (PRODUZIR=1) faz até 4 chamadas pagas: só use com autorização.
// Variáveis: BASE_URL, SENHA_MARCOS_ARQ, PAUTA (ex.: P001), PRODUZIR (0|1), FORCAR_BUSCA (0|1), AMBIENTE (producao|teste),
//            OUT_DIR, SHOT_TIPO (png|jpeg), LIMITE_BUSCA_MS (padrão 7 min)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE_URL || "https://editorial.mafraperformancelab.com.br";
const OUT = process.env.OUT_DIR || "./capturas-pautas";
const TIPO = process.env.SHOT_TIPO === "jpeg" ? "jpeg" : "png";
const PAUTA = process.env.PAUTA || "P001";
const PRODUZIR = process.env.PRODUZIR === "1";
const FORCAR_BUSCA = process.env.FORCAR_BUSCA === "1";
const AMBIENTE = process.env.AMBIENTE === "teste" ? "teste" : "producao";
const LIMITE = Number(process.env.LIMITE_BUSCA_MS || 7 * 60 * 1000);
const senha = fs.readFileSync(process.env.SENHA_MARCOS_ARQ, "utf8").trim();
fs.mkdirSync(OUT, { recursive: true });

const resultados = [];
const ok = (nome, cond, detalhe = "") => {
  resultados.push({ nome, ok: Boolean(cond), detalhe });
  console.log(`${cond ? "PASS" : "FAIL"} ${nome}${detalhe ? " — " + detalhe : ""}`);
  return Boolean(cond);
};
const shot = (page, nome) => page.screenshot({ path: path.join(OUT, `${nome}.${TIPO}`), fullPage: true, ...(TIPO === "jpeg" ? { quality: 70 } : {}) });

async function lerPauta(page) {
  const r = await page.request.get(`${BASE}/api/pautas`, { headers: { "X-Painel-Requisicao": "1" } });
  const b = await r.json();
  if (!b.ok) throw new Error(`leitura de pautas falhou: ${b.erro && b.erro.codigo}`);
  for (const pl of b.planos) {
    const p = pl.pautas.find((x) => x.id === PAUTA);
    if (p) return { plano: pl, pauta: p, lista: b };
  }
  throw new Error(`pauta ${PAUTA} não encontrada`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "pt-BR" })).newPage();
  const errosJs = [];
  page.on("pageerror", (e) => errosJs.push(String(e)));

  await page.goto(`${BASE}/entrar`);
  await page.getByLabel("Usuário").fill("marcos");
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/fila/);
  ok("login", true);

  await page.getByRole("link", { name: "Pautas" }).click();
  await page.waitForURL(/\/pautas$/);
  await page.getByRole("heading", { name: "Pautas", level: 1 }).waitFor();
  let { plano, pauta, lista } = await lerPauta(page);
  ok("lista de pautas lida do n8n", lista.planos.length > 0, `${lista.planos.length} plano(s), ${lista.planos.reduce((n, p) => n + p.pautas.length, 0)} pautas`);
  await shot(page, "p1-lista");

  await page.getByRole("link", { name: new RegExp(pauta.titulo.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
  await page.waitForURL(new RegExp(`/pautas/${plano.plano_id}/${PAUTA}$`));
  await page.getByRole("heading", { level: 1 }).waitFor();
  ok("detalhe da pauta", (await page.getByRole("heading", { level: 1 }).innerText()).includes(pauta.titulo.slice(0, 20)));
  const produzirBtn = page.getByRole("button", { name: "Produzir artigo" });
  ok("produzir bloqueado sem fontes aprovadas", pauta.fontes.estado === "aprovada" || (await produzirBtn.isDisabled()));
  await shot(page, "p2-pauta");

  if (FORCAR_BUSCA || pauta.fontes.estado !== "aprovada" || (pauta.fontes.proposta && pauta.fontes.proposta.status !== "pronta")) {
    const anterior = pauta.fontes.proposta ? pauta.fontes.proposta.gerado_em : null;
    await page.getByRole("button", { name: /Buscar (fontes|de novo)/ }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    const buscar = dlg.getByRole("button", { name: "Buscar fontes" });
    ok("busca bloqueada sem autorização", await buscar.isDisabled());
    await dlg.getByRole("checkbox").check();
    await buscar.click();
    await dlg.waitFor({ state: "detached" });
    await page.getByRole("status").filter({ hasText: /Buscando fontes/ }).waitFor({ timeout: 20000 });
    ok("tela acompanha a busca", true);
    const inicio = Date.now();
    while (Date.now() - inicio < LIMITE) {
      ({ pauta } = await lerPauta(page));
      if (pauta.fontes.proposta && pauta.fontes.proposta.gerado_em !== anterior) break;
      await page.waitForTimeout(5000);
    }
    const p = pauta.fontes.proposta;
    ok("busca de fontes terminou", p && p.gerado_em !== anterior, p ? `${p.status}; ${((Date.now() - inicio) / 1000).toFixed(0)} s; método ${p.metodo}` : "sem proposta");
    await page.waitForTimeout(9000);
    await shot(page, "p3-proposta");
    if (!p || p.status !== "pronta") {
      ok("proposta com 3 fontes", false, p ? `${p.status}/${p.motivo}; candidatos: ${p.candidatos.map((c) => `${c.dominio || c.url} ${c.situacao}/${c.motivo || ""}`).join("; ")}` : "");
      throw new Error("sem proposta pronta; parar antes de aprovar");
    }
    ok("proposta com 3 fontes", p.previas.length === 3, p.previas.map((x) => `${x.id} ${x.dominio} (${x.caracteres} car.)`).join("; "));
  }

  if (pauta.fontes.estado !== "aprovada" || (pauta.fontes.proposta && pauta.fontes.documentos.length && pauta.fontes.proposta.previas.some((x) => !pauta.fontes.documentos.some((d) => d.url === x.url)))) {
    await page.getByRole("button", { name: /Aprovar estas/ }).click();
    await page.getByText(/aprovadas em/).waitFor({ timeout: 30000 });
    ({ pauta } = await lerPauta(page));
    ok("fontes aprovadas", pauta.fontes.estado === "aprovada" && pauta.fontes.documentos.length === 3);
    await shot(page, "p4-aprovada");
  }

  const jaNaFila = pauta.trabalhos.find((t) => t.ambiente === AMBIENTE);
  if (PRODUZIR && !jaNaFila) {
    await page.reload();
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("button", { name: "Produzir artigo" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    const texto = await dlg.innerText();
    ok("diálogo mostra limite de chamadas e não inventa valor", /Até 4 chamadas/.test(texto) && /Valor em reais: não informado/.test(texto));
    if (await dlg.getByRole("radio").count()) await dlg.getByRole("radio", { name: AMBIENTE === "producao" ? /Produção/ : /Teste/ }).check();
    await dlg.getByRole("checkbox").check();
    await dlg.getByRole("button", { name: "Autorizar e produzir" }).click();
    await page.waitForURL(/\/fila\/[a-f0-9]{64}/, { timeout: 60000 });
    ok("redirecionou para o trabalho na fila", true, page.url().replace(BASE, ""));
    await page.getByRole("status").filter({ hasText: /em execução|Aguardando o produtor/ }).first().waitFor({ timeout: 60000 });
    ok("fila acompanha a produção", true);
    await page.waitForTimeout(4000);
    await shot(page, "p5-produzindo");
  } else if (PRODUZIR) {
    ok("pauta já tinha trabalho neste ambiente (não produzi de novo)", true, jaNaFila.job_key.slice(0, 12));
  }

  ok("nenhum erro de JavaScript", errosJs.length === 0, errosJs.join(" | ").slice(0, 300));
  await browser.close();
  const falhas = resultados.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, "resultado.json"), JSON.stringify({ resultados }, null, 2));
  console.log(`\n${resultados.length - falhas}/${resultados.length} PASS`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => {
  console.error("ERRO", e.message);
  fs.writeFileSync(path.join(OUT, "resultado.json"), JSON.stringify({ resultados, erro: e.message }, null, 2));
  process.exit(2);
});
