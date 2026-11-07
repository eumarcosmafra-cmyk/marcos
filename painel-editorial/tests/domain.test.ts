import { describe, expect, it } from "vitest";
import { applyCommand, type CommandContext, type EditorialCommand } from "@/domain/commands";
import { computeOverview, deriveArticleState, derivePautaState, extractSections } from "@/domain/rules";
import type { ProjectWorkspace, ReviewerIdentity } from "@/domain/types";
import { buildSeedWorkspaces, DEMO_REVIEWERS } from "@/data/seed";
import { LocalEditorialRepository, memoryStorage } from "@/data/local-repository";

const editor = DEMO_REVIEWERS.find((r) => r.role === "editor") as ReviewerIdentity;
const professor = DEMO_REVIEWERS.find((r) => r.role === "especialista") as ReviewerIdentity;

let tick = 0;
function ctx(actor: ReviewerIdentity = editor): CommandContext {
  return {
    actor,
    now: () => new Date(Date.UTC(2026, 10, 1, 12, 0, tick++)).toISOString(),
    newId: (p) => `${p}-${tick++}`,
  };
}

function run(ws: ProjectWorkspace, cmd: EditorialCommand, actor?: ReviewerIdentity): ProjectWorkspace {
  const r = applyCommand(ws, cmd, ctx(actor));
  if (!r.ok) throw new Error(r.error);
  return r.workspace;
}

function avtt(): ProjectWorkspace {
  return buildSeedWorkspaces()[0];
}

const ART = "art-fundamentos-boxe";

function article(ws: ProjectWorkspace) {
  const a = ws.articles.find((x) => x.id === ART);
  if (!a) throw new Error("artigo ausente");
  return a;
}

describe("vínculo entre aprovação e versão", () => {
  it("jornada completa: ajuste → nova versão → especialista → aprovação final → nova edição volta para revisão", () => {
    let ws = avtt();
    const v1 = article(ws).currentVersionId as string;
    expect(deriveArticleState(ws, article(ws)).stage).toBe("revisao_editorial");

    ws = run(ws, { type: "article.requestAdjustments", articleId: ART, versionId: v1, justification: "Dividir parágrafo longo", stage: "redacao" });
    expect(deriveArticleState(ws, article(ws)).stage).toBe("ajustes_solicitados");

    // Não é possível aprovar a versão que recebeu pedido de ajuste.
    const blocked = applyCommand(ws, { type: "article.approveEditorial", articleId: ART, versionId: v1, comment: "" }, ctx());
    expect(blocked.ok).toBe(false);

    // Ajuste não pode ser resolvido sem nova versão.
    const adj = ws.comments.find((c) => c.type === "ajuste") as { id: string };
    expect(applyCommand(ws, { type: "comment.resolve", commentId: adj.id, note: "ok" }, ctx()).ok).toBe(false);

    const v1md = article(ws).versions[0].markdown;
    ws = run(ws, { type: "article.saveVersion", articleId: ART, baseVersionId: v1, markdown: v1md + "\nNovo parágrafo.\n" });
    const v2 = article(ws).currentVersionId as string;
    expect(v2).not.toBe(v1);
    expect(article(ws).versions).toHaveLength(2);
    expect(article(ws).versions[0].markdown).toBe(v1md); // versão anterior preservada
    expect(deriveArticleState(ws, article(ws)).stage).toBe("revisao_editorial");

    // Pedido de ajuste aberto bloqueia aprovação editorial.
    expect(deriveArticleState(ws, article(ws)).canApproveEditorial.ok).toBe(false);
    ws = run(ws, { type: "comment.resolve", commentId: adj.id, note: "Parágrafo dividido na v2" });
    ws = run(ws, { type: "article.approveEditorial", articleId: ART, versionId: v2, comment: "Ok" });
    expect(deriveArticleState(ws, article(ws)).stage).toBe("revisao_especialista");

    // Editor não pode registrar revisão do especialista.
    expect(applyCommand(ws, { type: "article.specialistReview", articleId: ART, versionId: v2, outcome: "aprovado", comment: "x" }, ctx(editor)).ok).toBe(false);
    ws = run(ws, { type: "article.specialistReview", articleId: ART, versionId: v2, outcome: "aprovado", comment: "Técnica correta" }, professor);
    expect(deriveArticleState(ws, article(ws)).stage).toBe("aguardando_aprovacao_final");

    // Pendências de qualidade abertas bloqueiam a aprovação final.
    let st = deriveArticleState(ws, article(ws));
    expect(st.canApproveFinal.ok).toBe(false);
    expect(st.openQualityFlags.map((f) => f.kind).sort()).toEqual(["fontes", "legibilidade"]);
    for (const f of st.openQualityFlags) ws = run(ws, { type: "quality.resolve", flagId: f.id, note: "Conferido" });

    ws = run(ws, { type: "article.approveFinal", articleId: ART, versionId: v2, comment: "Aprovado" });
    st = deriveArticleState(ws, article(ws));
    expect(st.stage).toBe("aprovado_publicacao");
    expect(article(ws).publication).toBeUndefined(); // aprovado ≠ publicado

    // Alterar o texto depois da aprovação: nova versão volta para revisão.
    ws = run(ws, { type: "article.saveVersion", articleId: ART, baseVersionId: v2, markdown: article(ws).versions[1].markdown + "\nAjuste fino.\n" });
    st = deriveArticleState(ws, article(ws));
    expect(st.current?.number).toBe(3);
    expect(st.stage).toBe("revisao_editorial");
    expect(st.finalApproval).toBeUndefined();
    // As decisões da v2 continuam no histórico.
    const v2Decisions = ws.decisions.filter((d) => d.target.kind === "artigo" && d.target.versionId === v2).map((d) => d.kind);
    expect(v2Decisions).toEqual(expect.arrayContaining(["aprovacao_editorial", "revisao_especialista", "aprovacao_final"]));
    expect(st.historicalApprovals.length).toBeGreaterThanOrEqual(3);
  });

  it("solicitar ajustes retira a condição de aprovação final da mesma versão", () => {
    let ws = avtt();
    ws = { ...ws, qualityFlags: [] };
    const v1 = article(ws).currentVersionId as string;
    ws = run(ws, { type: "article.approveEditorial", articleId: ART, versionId: v1, comment: "" });
    ws = run(ws, { type: "article.specialistReview", articleId: ART, versionId: v1, outcome: "aprovado", comment: "ok" }, professor);
    ws = run(ws, { type: "article.approveFinal", articleId: ART, versionId: v1, comment: "" });
    expect(deriveArticleState(ws, article(ws)).stage).toBe("aprovado_publicacao");
    ws = run(ws, { type: "article.requestAdjustments", articleId: ART, versionId: v1, justification: "Erro técnico", stage: "revisao" });
    const st = deriveArticleState(ws, article(ws));
    expect(st.stage).toBe("ajustes_solicitados");
    expect(st.finalApproval).toBeUndefined();
  });

  it("recusa decisões sobre versão que não é a atual", () => {
    let ws = avtt();
    const v1 = article(ws).currentVersionId as string;
    ws = run(ws, { type: "article.saveVersion", articleId: ART, baseVersionId: v1, markdown: "# Novo texto" });
    const r = applyCommand(ws, { type: "article.approveEditorial", articleId: ART, versionId: v1, comment: "" }, ctx());
    expect(r.ok).toBe(false);
  });

  it("recusa salvar sobre base desatualizada (conflito)", () => {
    let ws = avtt();
    const v1 = article(ws).currentVersionId as string;
    ws = run(ws, { type: "article.saveVersion", articleId: ART, baseVersionId: v1, markdown: "# A" });
    const r = applyCommand(ws, { type: "article.saveVersion", articleId: ART, baseVersionId: v1, markdown: "# B" }, ctx());
    expect(r.ok).toBe(false);
  });
});

describe("pauta", () => {
  it("aprovar a pauta abre artigo em rascunho, sem aprovar o artigo", () => {
    let ws = avtt();
    const id = "pauta-muay-feminino";
    ws = run(ws, { type: "pauta.update", pautaId: id, patch: { briefingMarkdown: "## Novo briefing" } });
    ws = run(ws, { type: "pauta.approve", pautaId: id });
    const p = ws.pautas.find((x) => x.id === id);
    expect(p?.status).toBe("aprovada");
    const a = ws.articles.find((x) => x.id === p?.articleId);
    expect(a).toBeDefined();
    expect(a && deriveArticleState(ws, a).stage).toBe("rascunho");
    expect(ws.decisions.some((d) => d.target.kind === "artigo" && d.target.articleId === a?.id)).toBe(false);
  });

  it("editar pauta aprovada a devolve para revisão e preserva a aprovação no histórico", () => {
    let ws = avtt();
    const id = "pauta-fundamentos-boxe";
    ws = run(ws, { type: "pauta.update", pautaId: id, patch: { title: "Fundamentos do boxe: guia para iniciantes" } });
    const p = ws.pautas.find((x) => x.id === id);
    expect(p?.status).toBe("em_revisao");
    const st = derivePautaState(ws, p as NonNullable<typeof p>);
    expect(st.approvalForCurrentRevision).toBeUndefined();
    expect(st.supersededApproval).toBeDefined();
  });

  it("devolver exige comentário", () => {
    const ws = avtt();
    expect(applyCommand(ws, { type: "pauta.return", pautaId: "pauta-diferencas", comment: "  " }, ctx()).ok).toBe(false);
  });
});

describe("visão geral", () => {
  it("contadores calculados a partir dos dados", () => {
    const ws = avtt();
    const c = computeOverview(ws);
    expect(c.pautasAwaitingDecision).toBe(2);
    expect(c.articlesAwaitingReview).toBe(2);
    expect(c.articlesApproved).toBe(0);
    expect(c.openAdjustmentRequests).toBe(0);
  });

  it("seções do markdown ignoram blocos de código", () => {
    expect(extractSections("# A\n```\n# não\n```\n## B")).toEqual(["A", "B"]);
  });
});

describe("persistência local", () => {
  it("separa projetos em chaves distintas e sobrevive a nova instância", async () => {
    const storage = memoryStorage();
    const repo = new LocalEditorialRepository(storage);
    const projects = await repo.listProjects();
    expect(projects.map((p) => p.id)).toEqual(["avtt", "demo-cafe"]);
    const r = await repo.execute("demo-cafe", { type: "pauta.approve", pautaId: "pauta-cafe-coado" }, editor);
    expect(r.ok).toBe(true);
    const again = new LocalEditorialRepository(storage);
    const cafe = await again.getWorkspace("demo-cafe");
    const avttWs = await again.getWorkspace("avtt");
    expect(cafe?.pautas[0].status).toBe("aprovada");
    expect(cafe?.articles).toHaveLength(1);
    expect(avttWs?.articles.every((a) => a.projectId === "avtt")).toBe(true);
    expect(storage.keys().filter((k) => k.includes(":projeto:")).sort()).toEqual([
      "mafra-editorial:v1:projeto:avtt",
      "mafra-editorial:v1:projeto:demo-cafe",
    ]);
    // Nenhum segredo é persistido.
    const dump = storage.keys().map((k) => storage.getItem(k)).join("\n");
    expect(dump).not.toMatch(/service_role|api[_-]?key|password|senha|token/i);
  });
});
