// Validação no navegador de "Retomar produção" e "Solicitar correção".
// Mutações SÓ em registro do ambiente teste com execução simulada (fixtures, sem IA):
// o roteiro confere isso pela API antes de clicar em qualquer ação.
// Em produção, apenas abre o diálogo de autorização, confere o texto de custo e cancela.
//
// Variáveis: BASE_URL, SENHA_MARCOS_ARQ, JOB_TESTE, JOB_PROD_DIALOGO (opcional),
//            OUT_DIR, SHOT_TIPO (png|jpeg), LIMITE_MS (espera por produção; padrão 6 min)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUT = process.env.OUT_DIR || "./capturas-producao";
const TIPO = process.env.SHOT_TIPO === "jpeg" ? "jpeg" : "png";
const JOB_TESTE = process.env.JOB_TESTE;
const JOB_PROD = process.env.JOB_PROD_DIALOGO || "";
const LIMITE_MS = Number(process.env.LIMITE_MS || 6 * 60 * 1000);
const senha = fs.readFileSync(process.env.SENHA_MARCOS_ARQ, "utf8").trim();
fs.mkdirSync(OUT, { recursive: true });

const resultados = [];
const ok = (nome, cond, detalhe = "") => {
  resultados.push({ nome, ok: Boolean(cond), detalhe });
  console.log(`${cond ? "PASS" : "FAIL"} ${nome}${detalhe ? " — " + detalhe : ""}`);
  return Boolean(cond);
};
const shot = (page, nome) => page.screenshot({ path: path.join(OUT, `${nome}.${TIPO}`), fullPage: false, ...(TIPO === "jpeg" ? { quality: 70 } : {}) });

async function lerTrabalho(page, job, ambiente) {
  const r = await page.request.get(`${BASE}/api/fila/${job}?ambiente=${ambiente}`, { headers: { "X-Painel-Requisicao": "1" } });
  const b = await r.json();
  if (!b.ok) throw new Error(`leitura falhou: ${b.erro?.codigo}`);
  return b.trabalho;
}

async function esperarFimDaProducao(page, job) {
  const inicio = Date.now();
  const vistos = new Set();
  while (Date.now() - inicio < LIMITE_MS) {
    const t = await lerTrabalho(page, job, "teste");
    vistos.add(t.reserva ? `reserva:${t.reserva.etapa}` : t.estado);
    if (!t.reserva && !t.proxima_etapa) return { t, vistos: [...vistos], ms: Date.now() - inicio };
    await page.waitForTimeout(3000);
  }
  return { t: await lerTrabalho(page, job, "teste"), vistos: [...vistos], ms: Date.now() - inicio, esgotado: true };
}

async function autorizarNoDialogo(page, nomeBotao, prefixo) {
  await page.getByRole("button", { name: nomeBotao }).click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  await shot(page, `${prefixo}-dialogo`);
  const iniciar = dlg.getByRole("button", { name: /Autorizar e iniciar/ });
  ok(`${prefixo}: botão bloqueado sem autorização`, await iniciar.isDisabled());
  await dlg.getByRole("checkbox").check();
  ok(`${prefixo}: botão liberado após autorização`, await iniciar.isEnabled());
  return { dlg, iniciar };
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  const mutacoes = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/api\/fila\//.test(r.url())) mutacoes.push(r.url().replace(BASE, ""));
  });

  await page.goto(`${BASE}/entrar`);
  await page.getByLabel("Usuário").fill("marcos");
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await page.waitForURL(/\/fila/);
  ok("login", true);

  // ---------- produção: só o diálogo ----------
  if (JOB_PROD) {
    const t = await lerTrabalho(page, JOB_PROD, "producao");
    await page.goto(`${BASE}/fila/${JOB_PROD}?ambiente=producao`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    if (t.acoes.pode_solicitar_correcao) {
      await page.getByRole("button", { name: "Solicitar correção" }).click();
      const dlg = page.getByRole("dialog");
      await dlg.waitFor();
      const texto = await dlg.innerText();
      ok("produção: diálogo mostra limite de chamadas pagas", /Até 3 chamada/.test(texto) && /Redator \(1\) \+ Revisor \(2\)/.test(texto), texto.match(/Até .*?\./)?.[0]);
      ok("produção: diálogo não inventa valor em reais", /Valor em reais: não informado pela fila/.test(texto));
      ok("produção: motivos da devolução listados", t.decisao_atual.motivos.every((m) => texto.includes(m.slice(0, 40))));
      await shot(page, "p1-producao-dialogo-custo");
      await dlg.getByRole("button", { name: "Cancelar" }).click();
      ok("produção: cancelado sem enviar", !mutacoes.some((u) => u.includes(JOB_PROD)), mutacoes.join(", "));
    } else {
      ok("produção: correção indisponível neste registro (diálogo não testado)", true, `estado ${t.estado}`);
    }
  }

  // ---------- teste simulado: ciclo completo ----------
  let t = await lerTrabalho(page, JOB_TESTE, "teste");
  if (!ok("guarda: registro é do ambiente teste com execução simulada", t.ambiente === "teste" && t.modo_execucao === "simulado", `${t.ambiente}/${t.modo_execucao}`)) {
    throw new Error("Registro fora do teste simulado; nenhuma ação executada.");
  }
  await page.goto(`${BASE}/fila/${JOB_TESTE}?ambiente=teste`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  console.log(`estado inicial: ${t.estado} rev ${t.revisao} v${t.versao_artigo}`);

  if (t.proxima_etapa && !t.reserva) {
    const { dlg, iniciar } = await autorizarNoDialogo(page, "Retomar produção", "r1");
    ok("retomar: aviso de execução simulada", /execução simulada/i.test(await dlg.innerText()));
    await iniciar.click();
    await page.getByRole("status").filter({ hasText: /em execução|Aguardando o produtor/ }).first().waitFor({ timeout: 30000 });
    await shot(page, "r2-acompanhando");
    const fim = await esperarFimDaProducao(page, JOB_TESTE);
    t = fim.t;
    ok("retomar: produção terminou", !fim.esgotado, `${(fim.ms / 1000).toFixed(0)} s; passou por ${fim.vistos.join(" → ")}; final ${t.estado} rev ${t.revisao} v${t.versao_artigo}`);
    await page.waitForTimeout(12000); // um ciclo de acompanhamento da tela
    await shot(page, "r3-final");
  }

  // Só para o teste local: sai de um estado sem decisão salvando uma edição (registro teste simulado).
  if (process.env.PREPARAR_DEVOLUCAO === "1" && !["aguardando_editor", "pendente_ajustes", "aprovacao_simulada", "devolvido"].includes(t.estado) && !t.reserva) {
    const r = await page.request.post(`${BASE}/api/fila/${JOB_TESTE}/edicao?ambiente=teste`, {
      headers: { "X-Painel-Requisicao": "1", Origin: BASE },
      data: { op_uuid: "prep-" + Date.now(), revisao_esperada: t.revisao, artigo_sha256: t.artigo_sha256, markdown: `${t.artigo_markdown}\n\nEdição de teste do painel para reabrir a revisão.` },
    });
    const b = await r.json();
    t = await lerTrabalho(page, JOB_TESTE, "teste");
    ok("preparação: edição salva para reabrir a revisão (teste)", b.ok === true, `${t.estado} rev ${t.revisao} v${t.versao_artigo}`);
    await page.reload();
    await page.getByRole("heading", { level: 1 }).waitFor();
  }

  if (["aguardando_editor", "pendente_ajustes", "aprovacao_simulada"].includes(t.estado)) {
    await page.getByRole("button", { name: "Devolver com motivos" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Motivo 1").fill("Teste do painel: rever a abertura do texto (registro de teste).");
    await dlg.getByRole("checkbox").last().check();
    await dlg.getByRole("button", { name: "Registrar devolução" }).click();
    await dlg.waitFor({ state: "detached" });
    t = await lerTrabalho(page, JOB_TESTE, "teste");
    ok("devolução registrada (teste)", t.estado === "devolvido", `rev ${t.revisao}`);
  }

  if (t.estado === "devolvido") {
    await page.reload();
    await page.getByRole("heading", { level: 1 }).waitFor();
    const antes = t;
    const { dlg, iniciar } = await autorizarNoDialogo(page, "Solicitar correção", "c1");
    const texto = await dlg.innerText();
    ok("correção: motivos da devolução listados", antes.decisao_atual.motivos.every((m) => texto.includes(m.slice(0, 40))));
    await iniciar.click();
    await page.getByRole("status").filter({ hasText: /em execução|Aguardando o produtor/ }).first().waitFor({ timeout: 30000 });
    await shot(page, "c2-acompanhando");
    const fim = await esperarFimDaProducao(page, JOB_TESTE);
    t = fim.t;
    ok("correção: produção terminou", !fim.esgotado, `${(fim.ms / 1000).toFixed(0)} s; passou por ${fim.vistos.join(" → ")}; final ${t.estado} rev ${t.revisao} v${t.versao_artigo}`);
    ok("correção: histórico registra correcao_autorizada", t.historico.some((h) => h.evento === "correcao_autorizada"));
    ok("correção: nenhuma chamada nova contada (simulado)", t.chamadas.reservadas === antes.chamadas.reservadas, `${antes.chamadas.reservadas} → ${t.chamadas.reservadas}`);
    await page.waitForTimeout(12000);
    await shot(page, "c3-final");
    await page.getByRole("tab", { name: /Histórico/ }).click();
    await shot(page, "c4-historico");
    // A mesma devolução não pode ser consumida duas vezes.
    const repetir = await page.request.post(`${BASE}/api/fila/${JOB_TESTE}/correcao?ambiente=teste`, {
      headers: { "X-Painel-Requisicao": "1", Origin: BASE },
      data: { op_uuid: "repeticao-" + Date.now(), revisao_esperada: t.revisao, artigo_sha256: t.artigo_sha256, autorizo_chamadas_pagas: true },
    });
    const rb = await repetir.json();
    ok("correção: fila recusa repetir sem nova devolução", rb.ok === false, rb.erro?.codigo + (rb.erro?.detalhe?.codigo_fila ? `/${rb.erro.detalhe.codigo_fila}` : ""));
  }

  const semAutorizacao = await page.request.post(`${BASE}/api/fila/${JOB_TESTE}/producao?ambiente=teste`, {
    headers: { "X-Painel-Requisicao": "1", Origin: BASE },
    data: { revisao_esperada: t.revisao },
  });
  ok("API recusa disparo sem autorização explícita", (await semAutorizacao.json()).erro?.codigo === "PEDIDO_INVALIDO");

  await browser.close();
  const falhas = resultados.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, "resultado.json"), JSON.stringify({ resultados, final: { estado: t.estado, revisao: t.revisao, versao: t.versao_artigo } }, null, 2));
  console.log(`\n${resultados.length - falhas}/${resultados.length} PASS`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => {
  console.error("ERRO", e);
  process.exit(2);
});
