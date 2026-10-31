// Jornada de validação do painel editorial no navegador.
// Uso: node scripts/jornada-e2e.cjs <pasta-de-capturas>   (app rodando em http://localhost:3100)
// Requer Playwright disponível (npm i -D playwright && npx playwright install chromium).
const { chromium } = require("playwright");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.argv[2] || ".";
require("fs").mkdirSync(OUT, { recursive: true });
const log = [];
const ok = (step, cond, detail = "") => {
  log.push(`${cond ? "PASS" : "FAIL"} | ${step}${detail ? " | " + detail : ""}`);
  if (!cond) console.error("FAIL:", step, detail);
};
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
  let dialogs = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    // Por padrão aceita (confirmações de descarte); o teste do guard troca o comportamento.
    if (page.__dismissNext) {
      page.__dismissNext = false;
      await d.dismiss();
    } else await d.accept();
  });

  // 1. Abrir e selecionar o projeto
  await page.goto(BASE + "/");
  await page.waitForURL(/\/p\/avtt$/);
  await page.getByRole("heading", { name: "Visão geral" }).waitFor();
  ok("1. Abre o último/primeiro projeto (AVTT)", page.url().endsWith("/p/avtt"));
  ok("Indicador permanente de modo demonstração", await page.getByText("Modo demonstração — dados locais").first().isVisible());
  const counterText = async (label) => (await page.locator("a", { hasText: label }).first().innerText()).match(/\n(\d+)\n/)?.[1];
  ok("Contador pautas aguardando decisão = 2", (await counterText("Pautas aguardando decisão")) === "2");
  ok("Contador artigos aguardando revisão = 2", (await counterText("Artigos aguardando revisão")) === "2");
  await shot(page, "01-visao-geral");

  // Pautas: lista, quadro e busca
  await page.getByRole("link", { name: "Pautas", exact: true }).first().click();
  await page.getByRole("heading", { name: "Pautas e planejamento" }).waitFor();
  await shot(page, "02-pautas-lista");
  await page.getByRole("button", { name: "Quadro" }).click();
  await page.waitForURL(/visao=quadro/);
  await shot(page, "03-pautas-quadro");
  await page.getByLabel("Buscar por título ou palavra-chave").fill("boxe");
  await page.waitForTimeout(500);
  const boardCards = await page.locator("section[aria-labelledby^='col-'] li a").count();
  await page.getByRole("button", { name: "Lista" }).click();
  await page.waitForTimeout(300);
  const listRows = await page.locator("table tbody tr").count();
  ok("Lista e quadro sincronizados (mesmos filtros)", boardCards === listRows && listRows === 3, `quadro=${boardCards} lista=${listRows}`);
  await page.getByRole("button", { name: "Limpar filtros" }).click();

  // 2. Abrir pauta, editar briefing, salvar e aprovar
  await page.getByRole("link", { name: "Muay Thai feminino: como começar com segurança" }).click();
  await page.getByRole("heading", { name: "Muay Thai feminino: como começar com segurança" }).waitFor();
  await shot(page, "04-pauta-detalhe");
  await page.getByRole("button", { name: "Editar" }).click();
  const brief = page.getByLabel("Briefing (Markdown)");
  await brief.fill((await brief.inputValue()) + "\n\n## Observação da revisão\n- Incluir seção sobre proteção (bucal e bandagem).");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByText("Observação da revisão").waitFor();
  ok("2a. Briefing salvo (revisão 3)", await page.getByText("revisão 3").first().isVisible());
  await page.getByRole("button", { name: "Aprovar pauta" }).first().click();
  await page.getByLabel("Comentário (opcional)").fill("Aprovada para redação.");
  await page.getByRole("dialog").getByRole("button", { name: "Aprovar pauta" }).click();
  await page.getByText("Pauta aprovada").first().waitFor();
  ok("2b. Pauta aprovada e artigo aberto em rascunho", await page.getByRole("link", { name: "Abrir artigo" }).isVisible());
  await page.getByRole("link", { name: "Abrir artigo" }).click();
  await page.getByText("Ainda não existe versão deste artigo").waitFor();
  ok("Artigo da pauta aprovada está em Rascunho (aprovação da pauta ≠ artigo)", await page.locator("header").getByText("Rascunho", { exact: true }).isVisible());
  await shot(page, "05-artigo-rascunho");

  // 3. Rascunho demonstrativo: prévia e fontes
  await page.goto(BASE + "/p/avtt/artigos/art-fundamentos-boxe");
  await page.getByRole("heading", { name: "Fundamentos do boxe para iniciantes", level: 1, exact: true }).waitFor();
  ok("3a. Prévia renderizada", await page.locator(".article-prose .md-h2", { hasText: "Guarda e postura" }).isVisible());
  await shot(page, "06-artigo-previa");
  await page.getByRole("tab", { name: /Fontes utilizadas/ }).click();
  await page.getByRole("heading", { name: "Fatos do assunto" }).waitFor();
  ok("3b. Fontes separadas em três categorias", (await page.getByRole("heading", { name: "Método editorial/SEO" }).isVisible()) && (await page.getByRole("heading", { name: "Informações do cliente" }).isVisible()));
  ok("3c. Biblioteca sem recibo marcada 'Uso não comprovado'", (await page.getByText("Uso não comprovado nesta execução").count()) >= 2);
  await page.getByText("Expandir trecho").first().click();
  await shot(page, "07-artigo-fontes");

  // 4. Comentário e solicitação de ajuste
  await page.getByRole("tab", { name: /Comentários e ajustes/ }).click();
  await page.getByLabel("Vincular a uma seção").selectOption("Base e deslocamento");
  await page.getByPlaceholder("Escreva a observação").fill("Parágrafo longo demais para leitura no celular.");
  await page.getByRole("button", { name: "Registrar comentário" }).click();
  await page.getByText("Parágrafo longo demais para leitura no celular.").waitFor();
  ok("4a. Comentário vinculado à seção registrado", await page.getByText("Seção: Base e deslocamento").first().isVisible());
  await page.locator("header").getByRole("button", { name: "Solicitar ajustes" }).click();
  await page.getByLabel(/Justificativa/).fill("Dividir o parágrafo da seção Base e deslocamento e ampliar as perguntas frequentes.");
  await page.getByLabel("Etapa responsável").selectOption("redacao");
  await page.getByRole("dialog").getByRole("button", { name: "Registrar solicitação" }).click();
  await page.getByText(/Solicitação registrada na demonstração/).first().waitFor();
  ok("4b. Etapa = Ajustes solicitados", await page.locator("header").getByText("Ajustes solicitados", { exact: true }).isVisible());
  ok("Toast não diz 'Enviada ao agente'", (await page.getByText(/Enviada ao agente/).count()) === 0);
  await shot(page, "08-artigo-ajustes");

  // 5. Editar, salvar nova versão e comparar
  await page.getByRole("tab", { name: "Artigo" }).click();
  await page.getByRole("button", { name: "Editar Markdown" }).click();
  const ta = page.getByLabel("Markdown do artigo");
  let md = await ta.inputValue();
  md = md.replace(
    "e é um dos pontos que mais aparecem nas correções dos primeiros meses de treino.",
    "e é um dos pontos mais corrigidos nos primeiros meses.\n\nPor isso, vale treinar a base antes de pensar em força.",
  );
  md += '\n\n<script>window.__xss = 1</script>\n<img src="x" onerror="window.__xss = 2">\n[link perigoso](javascript:window.__xss=3)\n';
  await ta.fill(md);
  ok("Indicação de alterações não salvas", await page.getByText("Alterações não salvas").first().isVisible());

  // Guard: navegar com alterações não salvas pede confirmação
  page.__dismissNext = true;
  dialogs = [];
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Visão geral" }).click();
  await page.waitForTimeout(400);
  ok("Saída com alterações não salvas pede confirmação e permanece", dialogs.length === 1 && page.url().includes("art-fundamentos-boxe"));

  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await page.getByLabel("O que mudou (opcional)").fill("Parágrafo dividido; teste de HTML no conteúdo.");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar nova versão" }).click();
  await page.getByText(/v2 salva/).first().waitFor();
  ok("5a. Nova versão v2 criada", await page.locator("header").getByText("v2", { exact: true }).isVisible());
  // Segurança da prévia
  await page.getByRole("button", { name: "Prévia" }).click();
  const xss = await page.evaluate(() => window.__xss);
  const scriptInPreview = await page.locator(".article-prose script").count();
  const imgInPreview = await page.locator(".article-prose img").count();
  const literal = await page.locator(".article-prose").innerText();
  const dangerousHref = await page.locator('.article-prose a[href^="javascript"]').count();
  ok("Markdown seguro: nenhum script executado", xss === undefined, `__xss=${xss}`);
  ok("Markdown seguro: HTML exibido como texto, sem <script>/<img>", scriptInPreview === 0 && imgInPreview === 0 && literal.includes("<script>window.__xss = 1</script>"));
  ok("Markdown seguro: link javascript: neutralizado", dangerousHref === 0);
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await page.getByText(/Comparando/).waitFor();
  ok("5b. Comparação v1 → v2 com diferenças", (await page.locator("tr.diff-add, ins.diff-add").count()) > 0);
  await shot(page, "09-historico-diff");

  // 6. Revisão do especialista e aprovação final da v2
  await page.getByRole("tab", { name: /Comentários e ajustes/ }).click();
  const adjItem = page.locator("li", { hasText: "Dividir o parágrafo da seção" }).first();
  await adjItem.getByRole("button", { name: "Marcar como resolvido" }).click();
  await page.getByLabel(/O que foi conferido/).fill("Parágrafo dividido na v2.");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Registrar resolução" }).first().click();
    await page.getByLabel(/O que foi conferido/).fill("Conferido manualmente na v2.");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await page.waitForTimeout(300);
  }
  ok("Pendências de legibilidade e fontes resolvidas por pessoa", (await page.getByRole("button", { name: "Registrar resolução" }).count()) === 0);
  await page.getByRole("button", { name: "Aprovar para próxima etapa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Registrar aprovação editorial" }).click();
  await page.locator("header").getByText("Revisão do especialista", { exact: true }).waitFor();
  ok("Aprovação editorial → Revisão do especialista", true);
  await page.getByRole("button", { name: "Registrar revisão do especialista" }).click();
  await page.getByLabel("Quem revisou").selectOption({ label: "Professor responsável (demo)" });
  await page.getByLabel(/Comentário do especialista/).fill("Nomenclatura dos golpes conferida.");
  await page.getByRole("dialog").getByRole("button", { name: "Registrar revisão" }).click();
  await page.locator("header").getByText("Aguardando aprovação final", { exact: true }).waitFor();
  ok("6a. Revisão do especialista registrada na v2", true);
  await page.locator("header").getByRole("button", { name: "Aprovação final" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aprovar para publicação" }).click();
  await page.locator("header").getByText("Aprovado para publicação", { exact: true }).waitFor();
  ok("6b. Estado 'Aprovado para publicação'", true);
  ok("Publicar permanece desabilitado (integração pendente)", await page.locator("header").getByRole("button", { name: "Publicar" }).isDisabled());
  ok("Não marcado como Publicado", (await page.locator("header").getByText("Publicado", { exact: true }).count()) === 0);
  await shot(page, "10-aprovado-publicacao");

  // 7. Alterar novamente: nova versão exige revisão
  await page.getByRole("tab", { name: "Artigo" }).click();
  await page.getByRole("button", { name: "Editar Markdown" }).click();
  await ta.fill((await ta.inputValue()).replace("## Perguntas frequentes", "## Perguntas frequentes sobre os fundamentos"));
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  ok("Diálogo avisa que a aprovação fica no histórico", await page.getByRole("dialog").getByText(/permanecem somente no histórico/).isVisible());
  await page.getByRole("dialog").getByRole("button", { name: "Salvar nova versão" }).click();
  await page.locator("header").getByText("Revisão editorial", { exact: true }).waitFor();
  ok("7a. v3 volta para Revisão editorial", await page.locator("header").getByText("v3", { exact: true }).isVisible());
  await page.getByRole("tab", { name: /Histórico/ }).click();
  await page.getByText("somente histórico").first().waitFor();
  ok("7b. Decisões da v2 preservadas como histórico", (await page.getByText("somente histórico").count()) >= 3);
  await shot(page, "11-v3-historico");

  // 8. Recarregar: persistência, separação e contadores
  await page.reload();
  await page.locator("header").getByText("v3", { exact: true }).waitFor();
  ok("8a. Persistência após recarregar (v3, Revisão editorial)", await page.locator("header").getByText("Revisão editorial", { exact: true }).isVisible());
  await page.goto(BASE + "/p/avtt");
  await page.getByRole("heading", { name: "Visão geral" }).waitFor();
  const c1 = await counterText("Pautas aguardando decisão");
  const c2 = await counterText("Artigos aguardando revisão");
  ok("8b. Contadores recalculados (pautas=1, artigos=2)", c1 === "1" && c2 === "2", `pautas=${c1} artigos=${c2}`);
  await page.locator("#project-select").selectOption("demo-cafe");
  await page.waitForURL(/\/p\/demo-cafe/);
  await page.getByRole("heading", { name: "Visão geral" }).waitFor();
  const cafe1 = await counterText("Pautas aguardando decisão");
  const cafe2 = await counterText("Artigos aguardando revisão");
  ok("8c. Projeto exemplo isolado (pautas=1, artigos=0)", cafe1 === "1" && cafe2 === "0", `pautas=${cafe1} artigos=${cafe2}`);
  const leak = await page.getByText("Fundamentos do boxe").count();
  ok("8d. Nenhum item da AVTT no outro projeto", leak === 0);
  await page.goto(BASE + "/p/demo-cafe/artigos/art-fundamentos-boxe");
  await page.getByText("Artigo não encontrado neste projeto").waitFor({ timeout: 5000 }).catch(() => {});
  ok("8e. Artigo da AVTT não abre no projeto exemplo", await page.getByText("Artigo não encontrado neste projeto").isVisible());
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  ok("Persistência separada por projeto", keys.includes("mafra-editorial:v1:projeto:avtt") && keys.includes("mafra-editorial:v1:projeto:demo-cafe"), keys.join(", "));
  const dump = await page.evaluate(() => Object.values(localStorage).join("\n"));
  ok("Nenhum segredo no armazenamento local", !/service_role|api[_-]?key|password|senha|bearer/i.test(dump));

  // 9. Teclado
  await page.goto(BASE + "/p/avtt/artigos/art-fundamentos-boxe");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => document.activeElement?.textContent);
  ok("9a. Primeiro Tab = 'Pular para o conteúdo'", skip?.includes("Pular para o conteúdo"));
  await shot(page, "12-teclado-skip");
  await page.getByRole("tab", { name: "Artigo" }).focus();
  await page.keyboard.press("ArrowRight");
  const focusedTab = await page.evaluate(() => document.activeElement?.textContent);
  const sel = await page.getByRole("tab", { name: "Briefing" }).getAttribute("aria-selected");
  ok("9b. Setas navegam entre as abas (seleção e foco)", sel === "true" && focusedTab?.includes("Briefing"), `foco=${focusedTab}`);
  await shot(page, "13-teclado-abas");
  await page.getByRole("tab", { name: "Briefing" }).focus();
  await page.keyboard.press("ArrowLeft");
  await page.locator("header").getByRole("button", { name: "Solicitar ajustes" }).focus();
  await page.keyboard.press("Enter");
  const dialogOpen = await page.getByRole("dialog").isVisible();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const dialogClosed = !(await page.locator("dialog[open]").count());
  ok("9c. Diálogo abre com Enter e fecha com Esc", dialogOpen && dialogClosed);

  // Celular
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" });
  const m = await mctx.newPage();
  m.on("pageerror", (e) => consoleErrors.push("mobile pageerror: " + e.message));
  await m.goto(BASE + "/p/avtt");
  await m.getByRole("heading", { name: "Visão geral" }).waitFor();
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("9d. Celular: sem rolagem horizontal na visão geral", overflow <= 0, `overflow=${overflow}`);
  await m.screenshot({ path: path.join(OUT, "14-celular-visao-geral.png") });
  await m.getByRole("button", { name: "Abrir menu" }).click();
  await m.getByRole("dialog", { name: "Menu" }).waitFor();
  await m.screenshot({ path: path.join(OUT, "15-celular-menu.png") });
  await m.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Pautas" }).click();
  await m.getByRole("heading", { name: "Pautas e planejamento" }).waitFor();
  const overflow2 = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("9e. Celular: pautas sem rolagem horizontal", overflow2 <= 0, `overflow=${overflow2}`);
  await m.screenshot({ path: path.join(OUT, "16-celular-pautas.png") });
  await m.goto(BASE + "/p/avtt/artigos/art-fundamentos-boxe");
  await m.getByRole("heading", { level: 1 }).waitFor();
  const overflow3 = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok("9f. Celular: artigo sem rolagem horizontal", overflow3 <= 0, `overflow=${overflow3}`);
  await m.screenshot({ path: path.join(OUT, "17-celular-artigo.png"), fullPage: false });

  // Tela de configurações
  await page.goto(BASE + "/p/avtt/configuracoes");
  await page.getByRole("heading", { name: "Projeto e configurações" }).waitFor();
  await shot(page, "18-configuracoes");
  await page.locator("#modo-demonstracao").scrollIntoViewIfNeeded();
  await shot(page, "19-modo-demonstracao");

  ok("Sem erros de console/página", consoleErrors.length === 0, consoleErrors.join(" || "));
  console.log(log.join("\n"));
  await browser.close();
  process.exit(log.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => {
  console.log(log.join("\n"));
  console.error("ERRO:", e);
  process.exit(2);
});
