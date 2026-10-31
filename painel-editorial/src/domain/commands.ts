/**
 * Comandos do domínio editorial.
 *
 * Cada comando recebe o agregado do projeto e devolve um novo agregado (imutável)
 * ou um erro de validação. A implementação local aplica o comando no navegador;
 * a implementação futura enviará o MESMO comando para uma API, que deverá repetir
 * estas validações no servidor (o navegador não é fonte de verdade em produção).
 */
import { deriveArticleState, derivePautaState, getCurrentVersion } from "./rules";
import type {
  ActivityEvent,
  AdjustmentStage,
  Article,
  ArticleDecision,
  ArticleVersion,
  BriefingSnapshot,
  Comment,
  Pauta,
  PautaDecision,
  PautaInput,
  Project,
  ProjectWorkspace,
  ReviewerIdentity,
} from "./types";

export interface CommandContext {
  now: () => string;
  newId: (prefix: string) => string;
  actor: ReviewerIdentity;
}

export type CommandResult =
  | { ok: true; workspace: ProjectWorkspace; message: string; createdId?: string }
  | { ok: false; error: string };

export type EditorialCommand =
  | { type: "project.update"; patch: Partial<Pick<Project, "name" | "shortName" | "siteUrl" | "audience" | "editorialDirection" | "technicalOwner" | "location" | "requiresSpecialistReview">> }
  | { type: "pauta.create"; input: PautaInput }
  | { type: "pauta.update"; pautaId: string; patch: Partial<PautaInput> }
  | { type: "pauta.submit"; pautaId: string }
  | { type: "pauta.approve"; pautaId: string; comment?: string }
  | { type: "pauta.return"; pautaId: string; comment: string }
  | { type: "article.startManualDraft"; articleId: string }
  | { type: "article.saveVersion"; articleId: string; baseVersionId: string; markdown: string; changeNote?: string }
  | { type: "comment.add"; articleId: string; versionId: string; body: string; section?: string }
  | { type: "comment.addToPauta"; pautaId: string; body: string }
  | { type: "comment.resolve"; commentId: string; note: string }
  | { type: "article.requestAdjustments"; articleId: string; versionId: string; justification: string; stage: AdjustmentStage; section?: string }
  | { type: "article.approveEditorial"; articleId: string; versionId: string; comment: string }
  | { type: "article.specialistReview"; articleId: string; versionId: string; outcome: "aprovado" | "aprovado_com_observacoes"; comment: string }
  | { type: "article.approveFinal"; articleId: string; versionId: string; comment: string }
  | { type: "quality.resolve"; flagId: string; note: string };

function fail(error: string): CommandResult {
  return { ok: false, error };
}

function activity(
  ctx: CommandContext,
  ws: ProjectWorkspace,
  type: ActivityEvent["type"],
  summary: string,
  link: ActivityEvent["link"],
): ActivityEvent {
  return {
    id: ctx.newId("act"),
    projectId: ws.project.id,
    type,
    at: ctx.now(),
    actorName: ctx.actor.name,
    summary,
    link,
  };
}

export function snapshotBriefing(pauta: Pauta, at: string): BriefingSnapshot {
  return {
    pautaId: pauta.id,
    pautaRevision: pauta.revision,
    title: pauta.title,
    primaryKeyword: pauta.primaryKeyword,
    intent: pauta.intent,
    audience: pauta.audience,
    question: pauta.question,
    briefingMarkdown: pauta.briefingMarkdown,
    outlineMarkdown: pauta.outlineMarkdown,
    plannedLinks: pauta.plannedLinks.map((l) => ({ ...l })),
    capturedAt: at,
  };
}

function replace<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x));
}

function requireText(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return `${label} é obrigatório.`;
  return null;
}

function findArticleAndCheckVersion(
  ws: ProjectWorkspace,
  articleId: string,
  versionId: string,
): { article: Article; version: ArticleVersion } | string {
  const article = ws.articles.find((a) => a.id === articleId);
  if (!article) return "Artigo não encontrado neste projeto.";
  const current = getCurrentVersion(article);
  if (!current) return "O artigo ainda não tem versão.";
  if (current.id !== versionId) {
    const target = article.versions.find((v) => v.id === versionId);
    return `A decisão precisa referenciar a versão atual (v${current.number}). A v${target?.number ?? "?"} é histórica.`;
  }
  return { article, version: current };
}

function articleDecision(
  ctx: CommandContext,
  ws: ProjectWorkspace,
  article: Article,
  version: ArticleVersion,
  kind: ArticleDecision["kind"],
  comment: string,
  extra: Partial<ArticleDecision> = {},
): ArticleDecision {
  return {
    id: ctx.newId("dec"),
    projectId: ws.project.id,
    target: { kind: "artigo", articleId: article.id, versionId: version.id, versionNumber: version.number },
    kind,
    reviewerId: ctx.actor.id,
    reviewerName: ctx.actor.name,
    reviewerRole: ctx.actor.role,
    comment: comment.trim(),
    createdAt: ctx.now(),
    ...extra,
  };
}

const STAGE_LABEL: Record<AdjustmentStage, string> = {
  pesquisa: "Pesquisa",
  briefing: "Briefing",
  redacao: "Redação",
  revisao: "Revisão",
};

export function applyCommand(ws: ProjectWorkspace, cmd: EditorialCommand, ctx: CommandContext): CommandResult {
  const now = ctx.now();

  switch (cmd.type) {
    case "project.update": {
      const project: Project = { ...ws.project, ...cmd.patch, updatedAt: now };
      return { ok: true, workspace: { ...ws, project }, message: "Dados do projeto salvos localmente." };
    }

    case "pauta.create": {
      const err = requireText(cmd.input.title, "Título") ?? requireText(cmd.input.primaryKeyword, "Palavra-chave principal");
      if (err) return fail(err);
      const pauta: Pauta = {
        ...cmd.input,
        id: ctx.newId("pauta"),
        projectId: ws.project.id,
        revision: 1,
        status: "sugerida",
        isDemo: false,
        origin: { kind: "manual", label: `Criada manualmente por ${ctx.actor.name}` },
        createdAt: now,
        updatedAt: now,
      };
      return {
        ok: true,
        createdId: pauta.id,
        workspace: {
          ...ws,
          pautas: [...ws.pautas, pauta],
          activity: [...ws.activity, activity(ctx, ws, "criacao", `Pauta criada: “${pauta.title}”`, { kind: "pauta", pautaId: pauta.id })],
        },
        message: "Pauta criada.",
      };
    }

    case "pauta.update": {
      const pauta = ws.pautas.find((p) => p.id === cmd.pautaId);
      if (!pauta) return fail("Pauta não encontrada neste projeto.");
      const next: Pauta = { ...pauta, ...cmd.patch, revision: pauta.revision + 1, updatedAt: now };
      const err = requireText(next.title, "Título") ?? requireText(next.primaryKeyword, "Palavra-chave principal");
      if (err) return fail(err);
      let message = `Pauta salva (revisão ${next.revision}).`;
      if (pauta.status === "aprovada") {
        next.status = "em_revisao";
        message = `Pauta alterada após a aprovação: voltou para revisão (revisão ${next.revision}). A aprovação anterior permanece no histórico.`;
      }
      return {
        ok: true,
        workspace: {
          ...ws,
          pautas: replace(ws.pautas, next),
          activity: [...ws.activity, activity(ctx, ws, "edicao", `Pauta editada (rev. ${next.revision}): “${next.title}”`, { kind: "pauta", pautaId: next.id })],
        },
        message,
      };
    }

    case "pauta.submit": {
      const pauta = ws.pautas.find((p) => p.id === cmd.pautaId);
      if (!pauta) return fail("Pauta não encontrada neste projeto.");
      const st = derivePautaState(ws, pauta);
      if (!st.canSubmit.ok) return fail(st.canSubmit.reasons.join(" "));
      const decision: PautaDecision = {
        id: ctx.newId("dec"),
        projectId: ws.project.id,
        target: { kind: "pauta", pautaId: pauta.id, pautaRevision: pauta.revision },
        kind: "pauta_enviada_revisao",
        reviewerId: ctx.actor.id,
        reviewerName: ctx.actor.name,
        reviewerRole: ctx.actor.role,
        createdAt: now,
      };
      const next: Pauta = { ...pauta, status: "em_revisao", updatedAt: now };
      return {
        ok: true,
        workspace: { ...ws, pautas: replace(ws.pautas, next), decisions: [...ws.decisions, decision] },
        message: "Pauta enviada para revisão.",
      };
    }

    case "pauta.approve": {
      const pauta = ws.pautas.find((p) => p.id === cmd.pautaId);
      if (!pauta) return fail("Pauta não encontrada neste projeto.");
      const st = derivePautaState(ws, pauta);
      if (!st.canApprove.ok) return fail(st.canApprove.reasons.join(" "));
      const decision: PautaDecision = {
        id: ctx.newId("dec"),
        projectId: ws.project.id,
        target: { kind: "pauta", pautaId: pauta.id, pautaRevision: pauta.revision },
        kind: "pauta_aprovada",
        reviewerId: ctx.actor.id,
        reviewerName: ctx.actor.name,
        reviewerRole: ctx.actor.role,
        comment: cmd.comment?.trim() || undefined,
        createdAt: now,
      };
      let articles = ws.articles;
      let articleId = pauta.articleId;
      let message = "Pauta aprovada. Isso não aprova o futuro artigo.";
      if (!articleId) {
        const article: Article = {
          id: ctx.newId("art"),
          projectId: ws.project.id,
          pautaId: pauta.id,
          title: pauta.title,
          primaryKeyword: pauta.primaryKeyword,
          versions: [],
          isDemo: false,
          createdAt: now,
          updatedAt: now,
        };
        articles = [...articles, article];
        articleId = article.id;
        message = "Pauta aprovada. Um artigo em rascunho foi aberto; a aprovação da pauta não aprova o artigo.";
      }
      const next: Pauta = { ...pauta, status: "aprovada", articleId, updatedAt: now };
      return {
        ok: true,
        createdId: articleId,
        workspace: {
          ...ws,
          pautas: replace(ws.pautas, next),
          articles,
          decisions: [...ws.decisions, decision],
          activity: [...ws.activity, activity(ctx, ws, "aprovacao", `Pauta aprovada (rev. ${pauta.revision}): “${pauta.title}”`, { kind: "pauta", pautaId: pauta.id })],
        },
        message,
      };
    }

    case "pauta.return": {
      const pauta = ws.pautas.find((p) => p.id === cmd.pautaId);
      if (!pauta) return fail("Pauta não encontrada neste projeto.");
      const err = requireText(cmd.comment, "O comentário de devolução");
      if (err) return fail(err);
      const st = derivePautaState(ws, pauta);
      if (!st.canReturn.ok) return fail(st.canReturn.reasons.join(" "));
      const decision: PautaDecision = {
        id: ctx.newId("dec"),
        projectId: ws.project.id,
        target: { kind: "pauta", pautaId: pauta.id, pautaRevision: pauta.revision },
        kind: "pauta_devolvida",
        reviewerId: ctx.actor.id,
        reviewerName: ctx.actor.name,
        reviewerRole: ctx.actor.role,
        comment: cmd.comment.trim(),
        createdAt: now,
      };
      const comment: Comment = {
        id: ctx.newId("com"),
        projectId: ws.project.id,
        target: { kind: "pauta", pautaId: pauta.id },
        body: cmd.comment.trim(),
        authorId: ctx.actor.id,
        authorName: ctx.actor.name,
        createdAt: now,
        type: "observacao",
        status: "aberto",
      };
      const next: Pauta = { ...pauta, status: "devolvida", updatedAt: now };
      return {
        ok: true,
        workspace: {
          ...ws,
          pautas: replace(ws.pautas, next),
          decisions: [...ws.decisions, decision],
          comments: [...ws.comments, comment],
          activity: [...ws.activity, activity(ctx, ws, "devolucao", `Pauta devolvida: “${pauta.title}”`, { kind: "pauta", pautaId: pauta.id })],
        },
        message: "Pauta devolvida com comentário. Solicitação registrada na demonstração.",
      };
    }

    case "article.startManualDraft": {
      const article = ws.articles.find((a) => a.id === cmd.articleId);
      if (!article) return fail("Artigo não encontrado neste projeto.");
      if (article.versions.length > 0) return fail("O artigo já tem versões.");
      const pauta = ws.pautas.find((p) => p.id === article.pautaId);
      if (!pauta) return fail("A pauta de origem não foi encontrada.");
      const version: ArticleVersion = {
        id: ctx.newId("ver"),
        articleId: article.id,
        number: 1,
        markdown: `# ${pauta.title}\n\n${pauta.outlineMarkdown.trim() || "Escreva o artigo aqui."}\n`,
        createdAt: now,
        createdBy: ctx.actor.name,
        origin: { kind: "manual", label: `Rascunho manual iniciado por ${ctx.actor.name} a partir da estrutura da pauta` },
        changeNote: "Rascunho inicial manual a partir da estrutura sugerida.",
        briefing: snapshotBriefing(pauta, now),
      };
      const next: Article = { ...article, versions: [version], currentVersionId: version.id, updatedAt: now };
      return {
        ok: true,
        workspace: {
          ...ws,
          articles: replace(ws.articles, next),
          activity: [...ws.activity, activity(ctx, ws, "edicao", `Rascunho manual iniciado (v1): “${article.title}”`, { kind: "artigo", articleId: article.id })],
        },
        message: "Rascunho v1 criado. Ele entra em revisão editorial.",
      };
    }

    case "article.saveVersion": {
      const article = ws.articles.find((a) => a.id === cmd.articleId);
      if (!article) return fail("Artigo não encontrado neste projeto.");
      const current = getCurrentVersion(article);
      if (!current) return fail("O artigo ainda não tem versão.");
      if (current.id !== cmd.baseVersionId) {
        return fail(`Conflito: a versão atual é a v${current.number}. Recarregue antes de salvar para não sobrescrever outra edição.`);
      }
      if (cmd.markdown === current.markdown) return fail("Nenhuma alteração em relação à versão atual.");
      if (!cmd.markdown.trim()) return fail("O artigo não pode ficar vazio.");
      const before = deriveArticleState(ws, article);
      const version: ArticleVersion = {
        id: ctx.newId("ver"),
        articleId: article.id,
        number: Math.max(...article.versions.map((v) => v.number)) + 1,
        markdown: cmd.markdown,
        createdAt: now,
        createdBy: ctx.actor.name,
        origin: { kind: "manual", label: `Edição humana de ${ctx.actor.name}` },
        basedOnVersionId: current.id,
        changeNote: cmd.changeNote?.trim() || undefined,
        // A direção editorial da nova versão é a mesma que originou a base.
        briefing: current.briefing,
      };
      const next: Article = {
        ...article,
        versions: [...article.versions, version],
        currentVersionId: version.id,
        updatedAt: now,
      };
      const hadApproval = Boolean(before.editorialApproval || before.finalApproval || before.specialistReview);
      return {
        ok: true,
        workspace: {
          ...ws,
          articles: replace(ws.articles, next),
          activity: [...ws.activity, activity(ctx, ws, "edicao", `Nova versão v${version.number} salva: “${article.title}”`, { kind: "artigo", articleId: article.id, tab: "historico" })],
        },
        message: hadApproval
          ? `v${version.number} salva. Ela volta para revisão; as decisões da v${current.number} permanecem no histórico.`
          : `v${version.number} salva. A v${current.number} foi preservada.`,
      };
    }

    case "comment.add": {
      const found = findArticleAndCheckVersion(ws, cmd.articleId, cmd.versionId);
      if (typeof found === "string") return fail(found);
      const err = requireText(cmd.body, "O comentário");
      if (err) return fail(err);
      const comment: Comment = {
        id: ctx.newId("com"),
        projectId: ws.project.id,
        target: { kind: "artigo", articleId: found.article.id, versionId: found.version.id, versionNumber: found.version.number },
        section: cmd.section?.trim() || undefined,
        body: cmd.body.trim(),
        authorId: ctx.actor.id,
        authorName: ctx.actor.name,
        createdAt: now,
        type: "observacao",
        status: "aberto",
      };
      return {
        ok: true,
        workspace: {
          ...ws,
          comments: [...ws.comments, comment],
          activity: [...ws.activity, activity(ctx, ws, "comentario", `Comentário na v${found.version.number}: “${found.article.title}”`, { kind: "artigo", articleId: found.article.id, tab: "comentarios" })],
        },
        message: "Comentário registrado.",
      };
    }

    case "comment.addToPauta": {
      const pauta = ws.pautas.find((p) => p.id === cmd.pautaId);
      if (!pauta) return fail("Pauta não encontrada neste projeto.");
      const err = requireText(cmd.body, "O comentário");
      if (err) return fail(err);
      const comment: Comment = {
        id: ctx.newId("com"),
        projectId: ws.project.id,
        target: { kind: "pauta", pautaId: pauta.id },
        body: cmd.body.trim(),
        authorId: ctx.actor.id,
        authorName: ctx.actor.name,
        createdAt: now,
        type: "observacao",
        status: "aberto",
      };
      return {
        ok: true,
        workspace: {
          ...ws,
          comments: [...ws.comments, comment],
          activity: [...ws.activity, activity(ctx, ws, "comentario", `Comentário na pauta: “${pauta.title}”`, { kind: "pauta", pautaId: pauta.id })],
        },
        message: "Comentário registrado.",
      };
    }

    case "comment.resolve": {
      const comment = ws.comments.find((c) => c.id === cmd.commentId);
      if (!comment) return fail("Comentário não encontrado.");
      if (comment.status === "resolvido") return fail("O comentário já está resolvido.");
      if (comment.type === "ajuste") {
        const err = requireText(cmd.note, "A nota de resolução");
        if (err) return fail(err);
      }
      let resolvedInVersionId: string | undefined;
      if (comment.target.kind === "artigo") {
        const articleId = comment.target.articleId;
        const article = ws.articles.find((a) => a.id === articleId);
        const current = article ? getCurrentVersion(article) : undefined;
        if (comment.type === "ajuste" && current && current.id === comment.target.versionId) {
          return fail(`Este ajuste foi pedido na v${comment.target.versionNumber}. Salve uma nova versão antes de marcá-lo como resolvido.`);
        }
        resolvedInVersionId = current?.id;
      }
      const next: Comment = {
        ...comment,
        status: "resolvido",
        resolvedAt: now,
        resolvedBy: ctx.actor.name,
        resolvedInVersionId,
        resolutionNote: cmd.note.trim() || undefined,
      };
      const link: ActivityEvent["link"] =
        comment.target.kind === "artigo"
          ? { kind: "artigo", articleId: comment.target.articleId, tab: "comentarios" }
          : { kind: "pauta", pautaId: comment.target.pautaId };
      return {
        ok: true,
        workspace: {
          ...ws,
          comments: replace(ws.comments, next),
          activity: [...ws.activity, activity(ctx, ws, "resolucao", comment.type === "ajuste" ? "Pedido de ajuste marcado como resolvido" : "Comentário resolvido", link)],
        },
        message: "Marcado como resolvido.",
      };
    }

    case "article.requestAdjustments": {
      const found = findArticleAndCheckVersion(ws, cmd.articleId, cmd.versionId);
      if (typeof found === "string") return fail(found);
      const err = requireText(cmd.justification, "A justificativa");
      if (err) return fail(err);
      const st = deriveArticleState(ws, found.article);
      if (!st.canRequestAdjustments.ok) return fail(st.canRequestAdjustments.reasons.join(" "));
      const decision = articleDecision(ctx, ws, found.article, found.version, "ajustes_solicitados", cmd.justification, {
        adjustmentStage: cmd.stage,
      });
      const comment: Comment = {
        id: ctx.newId("com"),
        projectId: ws.project.id,
        target: { kind: "artigo", articleId: found.article.id, versionId: found.version.id, versionNumber: found.version.number },
        section: cmd.section?.trim() || undefined,
        body: cmd.justification.trim(),
        authorId: ctx.actor.id,
        authorName: ctx.actor.name,
        createdAt: now,
        type: "ajuste",
        adjustmentStage: cmd.stage,
        status: "aberto",
      };
      const lostFinal = Boolean(st.finalApproval);
      return {
        ok: true,
        workspace: {
          ...ws,
          decisions: [...ws.decisions, decision],
          comments: [...ws.comments, comment],
          activity: [...ws.activity, activity(ctx, ws, "ajuste", `Ajustes solicitados na v${found.version.number} (etapa: ${STAGE_LABEL[cmd.stage]}): “${found.article.title}”`, { kind: "artigo", articleId: found.article.id, tab: "comentarios" })],
        },
        message: lostFinal
          ? `Solicitação registrada na demonstração. A v${found.version.number} perdeu a condição de aprovada para publicação.`
          : "Solicitação registrada na demonstração. Envio ao agente: integração pendente.",
      };
    }

    case "article.approveEditorial": {
      const found = findArticleAndCheckVersion(ws, cmd.articleId, cmd.versionId);
      if (typeof found === "string") return fail(found);
      if (ctx.actor.role === "especialista") {
        return fail("A aprovação editorial deve ser registrada por um editor ou gestor. Troque a identidade local em Configurações.");
      }
      const st = deriveArticleState(ws, found.article);
      if (!st.canApproveEditorial.ok) return fail(st.canApproveEditorial.reasons.join(" "));
      const decision = articleDecision(ctx, ws, found.article, found.version, "aprovacao_editorial", cmd.comment);
      return {
        ok: true,
        workspace: {
          ...ws,
          decisions: [...ws.decisions, decision],
          activity: [...ws.activity, activity(ctx, ws, "aprovacao", `Aprovação editorial da v${found.version.number}: “${found.article.title}”`, { kind: "artigo", articleId: found.article.id, tab: "historico" })],
        },
        message: `Aprovação editorial registrada para a v${found.version.number}.`,
      };
    }

    case "article.specialistReview": {
      const found = findArticleAndCheckVersion(ws, cmd.articleId, cmd.versionId);
      if (typeof found === "string") return fail(found);
      if (ctx.actor.role !== "especialista") {
        return fail("A revisão do especialista precisa ser registrada por uma identidade com papel de especialista/professor.");
      }
      const err = requireText(cmd.comment, "O comentário do especialista");
      if (err) return fail(err);
      const st = deriveArticleState(ws, found.article);
      if (!st.canRegisterSpecialist.ok) return fail(st.canRegisterSpecialist.reasons.join(" "));
      const decision = articleDecision(ctx, ws, found.article, found.version, "revisao_especialista", cmd.comment, {
        specialistOutcome: cmd.outcome,
      });
      return {
        ok: true,
        workspace: {
          ...ws,
          decisions: [...ws.decisions, decision],
          activity: [...ws.activity, activity(ctx, ws, "revisao_especialista", `Revisão do especialista na v${found.version.number}: “${found.article.title}”`, { kind: "artigo", articleId: found.article.id, tab: "historico" })],
        },
        message: `Revisão do especialista registrada para a v${found.version.number}.`,
      };
    }

    case "article.approveFinal": {
      const found = findArticleAndCheckVersion(ws, cmd.articleId, cmd.versionId);
      if (typeof found === "string") return fail(found);
      if (ctx.actor.role === "especialista") {
        return fail("A aprovação final deve ser registrada por um editor ou gestor.");
      }
      const st = deriveArticleState(ws, found.article);
      if (!st.canApproveFinal.ok) return fail(st.canApproveFinal.reasons.join(" "));
      const decision = articleDecision(ctx, ws, found.article, found.version, "aprovacao_final", cmd.comment);
      return {
        ok: true,
        workspace: {
          ...ws,
          decisions: [...ws.decisions, decision],
          activity: [...ws.activity, activity(ctx, ws, "aprovacao", `Aprovado para publicação (v${found.version.number}): “${found.article.title}”`, { kind: "artigo", articleId: found.article.id, tab: "historico" })],
        },
        message: `v${found.version.number} aprovada para publicação. Isso não publica o conteúdo.`,
      };
    }

    case "quality.resolve": {
      const flag = ws.qualityFlags.find((f) => f.id === cmd.flagId);
      if (!flag) return fail("Pendência não encontrada.");
      if (flag.status === "resolvida") return fail("A pendência já está resolvida.");
      const err = requireText(cmd.note, "A nota de resolução");
      if (err) return fail(err);
      const article = ws.articles.find((a) => a.id === flag.articleId);
      const current = article ? getCurrentVersion(article) : undefined;
      const next = {
        ...flag,
        status: "resolvida" as const,
        resolvedAt: now,
        resolvedBy: ctx.actor.name,
        resolvedInVersionId: current?.id,
        resolutionNote: cmd.note.trim(),
      };
      return {
        ok: true,
        workspace: {
          ...ws,
          qualityFlags: replace(ws.qualityFlags, next),
          activity: [...ws.activity, activity(ctx, ws, "resolucao", `Pendência de ${flag.kind} resolvida${current ? ` na v${current.number}` : ""}`, { kind: "artigo", articleId: flag.articleId, tab: "comentarios" })],
        },
        message: "Pendência marcada como resolvida por decisão humana.",
      };
    }
  }
}
