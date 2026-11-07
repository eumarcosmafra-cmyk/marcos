// Validação do painel real no navegador (Playwright).
// Uso: node scripts/validar-painel-real.cjs
// Variáveis: BASE_URL, SENHA_MARCOS_ARQ, SENHA_LEITOR_ARQ, JOB_PROD (job_key do P004), OUT_DIR,
//            FASE = principal | erro | recuperacao
// Regras: em PRODUÇÃO só lê (abre diálogos sem enviar). Mutações só em registros do ambiente teste.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3200";
const OUT = process.env.OUT_DIR || "./capturas-real";
const FASE = process.env.FASE || "principal";
const JOB_PROD = process.env.JOB_PROD || "";
const senha = (arq) => fs.readFileSync(arq, "utf8").trim();
fs.mkdirSync(OUT, { recursive: true });

const log = [];
const ok = (passo, cond, detalhe = "") => {
  log.push(`${cond ? "PASS" : "FAIL"} | ${passo}${detalhe ? " | " + detalhe : ""}`);
};
const TIPO = process.env.SHOT_TIPO === "jpeg" ? "jpeg" : "png";
const shot = (page, nome, full = false) => page.screenshot({ path: path.join(OUT, `${nome}.${TIPO}`), fullPage: full, ...(TIPO === "jpeg" ? { quality: 70 } : {}) });

async function login(page, usuario, arq) {
  await page.goto(BASE + "/entrar");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha(arq));
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/fila/);
}

async function apiPost(page, url, body) {
  return page.evaluate(
    async ([u, b]) => {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json", "X-Painel-Requisicao": "1" }, body: JSON.stringify(b) });
      return { status: r.status, body: await r.json() };
    },
    [url, body],
  );
}
async function apiGet(page, url) {
  return page.evaluate(async (u) => {
    const r = await fetch(u);
    return { status: r.status, body: await r.json() };
  }, url);
}

async function principal(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(() => { window.__xss = undefined; });

  // 1. Login
  await page.goto(BASE + "/fila");
  ok("1a. Sem sessão, /fila redireciona ao login", /\/entrar/.test(page.url()), page.url());
  await page.getByLabel("Usuário").fill("marcos");
  await page.getByLabel("Senha").fill("senha-errada-para-teste");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.locator("#login-erro").waitFor();
  ok("1b. Senha errada é recusada", (await page.locator("#login-erro").innerText()).includes("LOGIN_RECUSADO"));
  await login(page, "marcos", process.env.SENHA_MARCOS_ARQ);
  ok("1c. Login de Marcos", page.url().includes("/fila"));

  // 2. Lista real (produção)
  await page.getByRole("heading", { name: "Pautas e trabalhos" }).waitFor();
  await page.locator("table tbody tr, ul li a.card").first().waitFor({ timeout: 60000 });
  const linhaP004 = page.locator("table tbody tr", { hasText: "P004" });
  ok("2a. Fila de produção lista o P004", (await linhaP004.count()) >= 1);
  const textoLinha = (await linhaP004.first().innerText()).replace(/\s+/g, " ");
  ok("2b. Linha do P004 mostra palavra-chave e estado", /wai kru significado/i.test(textoLinha) && /Pendente de ajustes/i.test(textoLinha), textoLinha.slice(0, 200));
  await shot(page, "01-fila-producao");

  // 3. Abrir P004
  const href = await linhaP004.first().locator("a").first().getAttribute("href");
  ok("3a. Link do P004 aponta para o job_key informado", !JOB_PROD || (href || "").includes(JOB_PROD), href || "");
  await linhaP004.first().locator("a").first().click();
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  const cab = (await page.locator("header.card").innerText()).replace(/\s+/g, " ");
  ok("3b. Cabeçalho: P004, v1, revisão do registro e estado", /P004/.test(cab) && /Versão do artigo: v1/.test(cab) && /Revisão do registro: \d+/.test(cab) && /Pendente de ajustes/.test(cab), cab.slice(0, 300));
  ok("3c. Aprovação editorial pendente", /Aprovação editorial\s*Pendente/i.test(cab));
  ok("3d. Revisão do professor não realizada", /Revisão do professor\s*Não realizada/i.test(cab));
  ok("3e. Publicação não autorizada", /Publicação\s*Não autorizada/i.test(cab));
  const prose = page.locator(".article-prose").first();
  const nStrong = await prose.locator("strong").count();
  const nLinks = await prose.locator('a[href^="https://"]').count();
  const nLi = await prose.locator("li").count();
  const nTable = await prose.locator("table").count();
  ok("3f. Markdown renderizado (negrito, links, listas)", nStrong > 0 && nLinks > 0, `strong=${nStrong} links=${nLinks} li=${nLi} tabelas=${nTable}`);
  ok("3g. Nenhum script do conteúdo executado", (await page.evaluate(() => window.__xss)) === undefined && (await prose.locator("script").count()) === 0);
  await shot(page, "02-p004-artigo");
  await shot(page, "02b-p004-artigo-completo", true);

  await page.getByRole("tab", { name: /Pendências do Revisor/ }).click();
  const pend = await page.locator("ol > li.card").count();
  ok("3h. Três pendências exibidas", pend === 3, `pendencias=${pend}`);
  await shot(page, "03-p004-pendencias");

  // Aprovação em PRODUÇÃO: só verifica o bloqueio do formulário, sem enviar.
  await page.getByRole("button", { name: "Aprovar editorialmente" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  const enviar = dlg.getByRole("button", { name: "Registrar aprovação editorial" });
  const bloq1 = await enviar.isDisabled();
  await dlg.getByRole("checkbox", { name: /Confirmo que fiz a revisão editorial/ }).check();
  const bloq2 = await enviar.isDisabled();
  ok("3i. Aprovar exige avaliar cada pendência e justificar (botão bloqueado)", bloq1 && bloq2);
  ok("3j. Justificativa começa vazia (nada preenchido automaticamente)", (await dlg.getByLabel(/Justificativa para aprovar/).inputValue()) === "");
  await shot(page, "04-p004-dialogo-aprovacao-bloqueado");
  await dlg.getByRole("button", { name: "Cancelar" }).click();

  // 4. Persistência após recarregar
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  ok("4. Após recarregar, P004 continua carregado do n8n", /P004/.test(await page.locator("header.card").innerText()));

  // 5. Ambiente teste
  await page.goto(BASE + "/fila?ambiente=teste");
  await page.locator("table tbody tr").first().waitFor({ timeout: 60000 });
  const lista = await apiGet(page, "/api/fila?ambiente=teste");
  const testes = (lista.body.trabalhos || []).filter((t) => t.ambiente === "teste");
  ok("5a. Ambiente teste lista registros de teste", testes.length >= 2, `n=${testes.length}`);
  const prodVazio = (lista.body.trabalhos || []).every((t) => t.ambiente === "teste");
  ok("5b. Filtro não mistura produção e teste", prodVazio);
  await shot(page, "05-fila-teste");
  const [A, B] = testes;

  // 6. Edição em A → nova versão
  await page.goto(`${BASE}/fila/${A.job_key}?ambiente=teste`);
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  const antes = await apiGet(page, `/api/fila/${A.job_key}?ambiente=teste`);
  const tA = antes.body.trabalho;
  await page.getByRole("button", { name: "Editar Markdown" }).click();
  const ta = page.getByLabel("Markdown do artigo");
  await ta.fill((await ta.inputValue()) + `\n\nParágrafo de teste do painel (${new Date().toISOString()}).\n`);
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  ok("6a. Rascunho local não salvo sobrevive ao recarregar", (await page.getByText("Alterações não salvas").count()) > 0);
  await page.getByRole("button", { name: "Salvar nova versão" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Salvar nova versão" }).click();
  await page.getByText(/Versão v\d+ criada/).first().waitFor({ timeout: 60000 });
  const depois = (await apiGet(page, `/api/fila/${A.job_key}?ambiente=teste`)).body.trabalho;
  ok("6b. Edição criou nova versão e nova revisão", depois.versao_artigo === tA.versao_artigo + 1 && depois.revisao === tA.revisao + 1 && depois.estado === "aguardando_editor", `v${tA.versao_artigo}->v${depois.versao_artigo} rev ${tA.revisao}->${depois.revisao} ${depois.estado}`);
  await page.getByRole("tab", { name: /Histórico e versões/ }).click();
  await page.getByRole("button", { name: "Comparar com a atual" }).first().click();
  await page.getByText(/Comparação v\d+ → v\d+/).waitFor({ timeout: 60000 });
  ok("6c. Comparação entre versões com diferenças", (await page.locator("tr.diff-add, ins.diff-add").count()) > 0);
  await shot(page, "06-teste-historico-comparacao");

  // 7. Recusa de versão antiga
  const velho = await apiPost(page, `/api/fila/${A.job_key}/edicao?ambiente=teste`, { op_uuid: `t-${Date.now()}-velho`, revisao_esperada: tA.revisao, artigo_sha256: tA.artigo_sha256, markdown: "x".repeat(300) });
  ok("7. Versão antiga é recusada", velho.status === 409 && velho.body.erro.codigo === "VERSAO_DESATUALIZADA", `${velho.status} ${JSON.stringify(velho.body.erro)}`);

  // 8. Devolução com motivos em A (UI)
  await page.getByRole("tab", { name: "Artigo" }).click();
  await page.getByRole("button", { name: "Devolver com motivos" }).click();
  const dd = page.getByRole("dialog");
  await dd.getByLabel("Motivo 1").fill("Teste do painel: rever a abertura sem mudar os fatos.");
  await dd.getByRole("checkbox", { name: /Confirmo que fiz a revisão editorial/ }).check();
  await dd.getByRole("button", { name: "Registrar devolução" }).click();
  await page.getByText(/Devolução registrada/).first().waitFor({ timeout: 60000 });
  const devol = (await apiGet(page, `/api/fila/${A.job_key}?ambiente=teste`)).body.trabalho;
  ok("8. Devolução com motivos registrada", devol.estado === "devolvido" && devol.decisao_atual?.decisao === "devolver" && devol.decisao_atual.motivos.length === 1 && devol.decisao_atual.simulacao === true, `${devol.estado}`);
  await shot(page, "07-teste-devolvido");

  // 9. B: edição e aprovação simulada; recusa sem avaliação explícita
  const tB0 = (await apiGet(page, `/api/fila/${B.job_key}?ambiente=teste`)).body.trabalho;
  const ed = await apiPost(page, `/api/fila/${B.job_key}/edicao?ambiente=teste`, { op_uuid: `t-${Date.now()}-edb`, revisao_esperada: tB0.revisao, artigo_sha256: tB0.artigo_sha256, markdown: (tB0.artigo_markdown || "") + `\n\nAjuste de teste (${Date.now()}).\n` });
  ok("9a. Edição em B (API) criou versão", ed.status === 200, JSON.stringify(ed.body).slice(0, 160));
  const tB = (await apiGet(page, `/api/fila/${B.job_key}?ambiente=teste`)).body.trabalho;
  const semPend = await apiPost(page, `/api/fila/${B.job_key}/decisao?ambiente=teste`, { op_uuid: `t-${Date.now()}-sp`, decisao: "aprovar", revisao_esperada: tB.revisao, artigo_sha256: tB.artigo_sha256, confirmo_revisao_editorial: true });
  ok("9b. Aprovação sem avaliação explícita das pendências é recusada pela fila", semPend.status === 422 && semPend.body.erro.codigo === "PENDENCIAS_SEM_AVALIACAO", `${semPend.status} ${JSON.stringify(semPend.body.erro)}`);
  await page.goto(`${BASE}/fila/${B.job_key}?ambiente=teste`);
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Aprovar editorialmente" }).click();
  const da = page.getByRole("dialog");
  const btn = da.getByRole("button", { name: "Registrar aprovação editorial" });
  const nPend = await da.locator('input[id^="pend-"]').count();
  for (let i = 0; i < nPend; i += 1) await da.locator(`#pend-${i}`).check();
  await da.getByRole("checkbox", { name: /Confirmo que fiz a revisão editorial/ }).check();
  const aindaBloq = await btn.isDisabled();
  await da.getByLabel(/Justificativa para aprovar/).fill("Teste do painel: pendências lidas; validação do professor segue pendente.");
  ok("9c. Botão só libera com pendências avaliadas e justificativa", aindaBloq && !(await btn.isDisabled()));
  await shot(page, "08-teste-aprovacao-pendencias");
  await btn.click();
  await page.getByText(/Aprovação simulada registrada/).first().waitFor({ timeout: 60000 });
  const apr = (await apiGet(page, `/api/fila/${B.job_key}?ambiente=teste`)).body.trabalho;
  ok("9d. Aprovação simulada registrada sem virar aprovação real", apr.estado === "aprovacao_simulada" && apr.controle.aprovacao_editorial === false && apr.controle.publicacao_autorizada === false, apr.estado);
  ok("9e. Revisão do professor e publicação seguem não realizadas", /Não realizada/.test(await page.locator("header.card").innerText()) && /Não autorizada/.test(await page.locator("header.card").innerText()));
  await shot(page, "09-teste-aprovacao-simulada");

  // 10. Usuário não autorizado
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/entrar/);
  if (process.env.SENHA_LEITOR_ARQ) {
    await login(page, "leitor_teste", process.env.SENHA_LEITOR_ARQ);
    await page.goto(`${BASE}/fila/${A.job_key}?ambiente=teste`);
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
    ok("10a. Leitor vê o trabalho, mas sem ações", (await page.getByRole("button", { name: "Aprovar editorialmente" }).isDisabled()) && (await page.getByRole("button", { name: "Devolver com motivos" }).isDisabled()));
    const t = (await apiGet(page, `/api/fila/${A.job_key}?ambiente=teste`)).body.trabalho;
    const recusa = await apiPost(page, `/api/fila/${A.job_key}/decisao?ambiente=teste`, { op_uuid: `t-${Date.now()}-leitor`, decisao: "devolver", revisao_esperada: t.revisao, artigo_sha256: t.artigo_sha256, confirmo_revisao_editorial: true, motivos: ["Tentativa sem permissão."] });
    ok("10b. Decisão de usuário não autorizado é recusada", recusa.status === 403 && recusa.body.erro.codigo === "NAO_AUTORIZADO", `${recusa.status} ${JSON.stringify(recusa.body.erro)}`);
    const forjado = await apiPost(page, `/api/fila/${A.job_key}/edicao?ambiente=teste`, { op_uuid: "abcd1234", revisao_esperada: 1, artigo_sha256: t.artigo_sha256, markdown: "x".repeat(300), ator_id: "marcos_mafra" });
    ok("10c. Corpo com ator_id forjado é recusado", forjado.status === 403 || forjado.status === 400, String(forjado.status));
    await shot(page, "10-leitor-sem-acoes");
  }

  // 11. Celular
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const mp = await m.newPage();
  await login(mp, "marcos", process.env.SENHA_MARCOS_ARQ);
  await mp.goto(`${BASE}/fila`);
  await mp.locator("ul li a.card").first().waitFor({ timeout: 60000 });
  await mp.locator("ul li a.card", { hasText: "P004" }).first().click();
  await mp.getByRole("heading", { level: 1 }).waitFor({ timeout: 60000 });
  const ov = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("11. Celular: P004 sem rolagem horizontal", ov <= 0, `overflow=${ov}`);
  await mp.screenshot({ path: path.join(OUT, `11-celular-p004.${TIPO}`), ...(TIPO === "jpeg" ? { quality: 70 } : {}) });

  ok("Sem erros de JavaScript na página", erros.length === 0, erros.join(" | "));
  await ctx.close();
  await m.close();
}

async function faseErro(browser, recuperar) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  await login(page, "marcos", process.env.SENHA_MARCOS_ARQ);
  if (!recuperar) {
    const alerta = page.locator('[role="alert"]', { hasText: "Código" }).first();
    await alerta.waitFor({ timeout: 90000 });
    const t = await alerta.innerText();
    ok("E1. Falha de conexão exibe erro identificável (sem dados simulados)", /N8N_INDISPONIVEL|N8N_TEMPO_ESGOTADO|N8N_/.test(t) && (await page.locator("table tbody tr").count()) === 0, t.replace(/\s+/g, " ").slice(0, 200));
    ok("E2. Botão Tentar novamente disponível", await page.getByRole("button", { name: "Tentar novamente" }).isVisible());
    await shot(page, "12-erro-conexao");
    fs.writeFileSync(path.join(OUT, "estado-erro.json"), JSON.stringify(await ctx.storageState()));
  } else {
    await page.locator("table tbody tr").first().waitFor({ timeout: 90000 });
    ok("E3. Após restabelecer a conexão, a fila volta a carregar", (await page.locator("table tbody tr", { hasText: "P004" }).count()) >= 1);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (FASE === "principal") await principal(browser);
    else if (FASE === "erro") await faseErro(browser, false);
    else if (FASE === "recuperacao") await faseErro(browser, true);
  } catch (e) {
    log.push(`ERRO | ${e && e.message ? e.message.split("\n")[0] : e}`);
  } finally {
    await browser.close();
  }
  console.log(log.join("\n"));
  fs.writeFileSync(path.join(OUT, `resultado-${FASE}.txt`), log.join("\n") + "\n");
  process.exit(log.some((l) => !l.startsWith("PASS")) ? 1 : 0);
})();
