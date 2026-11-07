/**
 * Regras editoriais puras (sem React, sem armazenamento).
 *
 * Princípios:
 * - O ciclo da pauta, o ciclo do artigo e as pendências de qualidade são modelados
 *   separadamente. O estado do artigo é DERIVADO das decisões registradas sobre a
 *   versão atual — nunca é um campo que alguém possa "marcar".
 * - Toda decisão de artigo referencia uma versão. Uma nova versão não herda
 *   aprovações: volta para revisão editorial, e as decisões anteriores ficam no
 *   histórico.
 * - Solicitar ajustes sobre uma versão a retira definitivamente da condição de
 *   aprovação (inclusive final). É preciso salvar uma nova versão.
 * - Parecer de IA nunca conta como decisão humana.
 */
import type {
  Article,
  ArticleDecision,
  ArticleVersion,
  Comment,
  Decision,
  Pauta,
  PautaDecision,
  ProjectWorkspace,
  QualityFlag,
  ReviewerRole,
} from "./types";

export type ArticleStage =
  | "rascunho"
  | "revisao_editorial"
  | "ajustes_solicitados"
  | "revisao_especialista"
  | "aguardando_aprovacao_final"
  | "aprovado_publicacao"
  | "publicado";

export interface Gate {
  ok: boolean;
  reasons: string[];
}

export interface ArticleState {
  stage: ArticleStage;
  current?: ArticleVersion;
  /** Decisões sobre a versão atual, em ordem cronológica. */
  currentDecisions: ArticleDecision[];
  adjustmentOnCurrent?: ArticleDecision;
  editorialApproval?: ArticleDecision;
  specialistReview?: ArticleDecision;
  finalApproval?: ArticleDecision;
  requiresSpecialistReview: boolean;
  openAdjustments: Comment[];
  openQualityFlags: QualityFlag[];
  /** Aprovações registradas em versões anteriores (somente histórico). */
  historicalApprovals: ArticleDecision[];
  canApproveEditorial: Gate;
  canRegisterSpecialist: Gate;
  canApproveFinal: Gate;
  canRequestAdjustments: Gate;
  lastUpdatedAt: string;
}

export function isArticleDecision(d: Decision): d is ArticleDecision {
  return d.target.kind === "artigo";
}

export function isPautaDecision(d: Decision): d is PautaDecision {
  return d.target.kind === "pauta";
}

export function byDateAsc<T extends { createdAt: string }>(a: T, b: T): number {
  return a.createdAt.localeCompare(b.createdAt);
}

export function getCurrentVersion(article: Article): ArticleVersion | undefined {
  if (!article.currentVersionId) return undefined;
  return article.versions.find((v) => v.id === article.currentVersionId);
}

export function getArticleDecisions(ws: ProjectWorkspace, articleId: string): ArticleDecision[] {
  return ws.decisions
    .filter(isArticleDecision)
    .filter((d) => d.target.articleId === articleId)
    .sort(byDateAsc);
}

export function getPautaDecisions(ws: ProjectWorkspace, pautaId: string): PautaDecision[] {
  return ws.decisions
    .filter(isPautaDecision)
    .filter((d) => d.target.pautaId === pautaId)
    .sort(byDateAsc);
}

function lastOf<T>(list: T[], pred: (t: T) => boolean): T | undefined {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (pred(list[i])) return list[i];
  }
  return undefined;
}

const EDITORIAL_ROLES: ReviewerRole[] = ["editor", "gestor"];

export function canRoleApproveEditorial(role: ReviewerRole): boolean {
  return EDITORIAL_ROLES.includes(role);
}

export function canRoleApproveFinal(role: ReviewerRole): boolean {
  return EDITORIAL_ROLES.includes(role);
}

export function deriveArticleState(ws: ProjectWorkspace, article: Article): ArticleState {
  const current = getCurrentVersion(article);
  const all = getArticleDecisions(ws, article.id);
  const currentDecisions = current ? all.filter((d) => d.target.versionId === current.id) : [];
  const requiresSpecialistReview = ws.project.requiresSpecialistReview;

  const openAdjustments = ws.comments.filter(
    (c) => c.target.kind === "artigo" && c.target.articleId === article.id && c.type === "ajuste" && c.status === "aberto",
  );
  const openQualityFlags = ws.qualityFlags.filter((f) => f.articleId === article.id && f.status === "aberta");

  const adjustmentOnCurrent = lastOf(currentDecisions, (d) => d.kind === "ajustes_solicitados");
  // Aprovações anteriores a um pedido de ajuste na mesma versão perdem efeito.
  const effective = adjustmentOnCurrent ? [] : currentDecisions;
  const editorialApproval = lastOf(effective, (d) => d.kind === "aprovacao_editorial");
  const specialistReview = lastOf(effective, (d) => d.kind === "revisao_especialista");
  const finalApproval = lastOf(effective, (d) => d.kind === "aprovacao_final");

  const historicalApprovals = all.filter(
    (d) =>
      (d.kind === "aprovacao_editorial" || d.kind === "aprovacao_final" || d.kind === "revisao_especialista") &&
      (!current || d.target.versionId !== current.id || Boolean(adjustmentOnCurrent)),
  );

  let stage: ArticleStage;
  if (!current) stage = "rascunho";
  else if (adjustmentOnCurrent) stage = "ajustes_solicitados";
  else if (article.publication && article.publication.versionId === current.id && finalApproval) stage = "publicado";
  else if (finalApproval) stage = "aprovado_publicacao";
  else if (!editorialApproval) stage = "revisao_editorial";
  else if (requiresSpecialistReview && !specialistReview) stage = "revisao_especialista";
  else stage = "aguardando_aprovacao_final";

  const base: string[] = [];
  if (!current) base.push("Ainda não existe versão do artigo.");
  if (adjustmentOnCurrent) {
    base.push(`Ajustes foram solicitados na v${current?.number}. Salve uma nova versão para retomar a revisão.`);
  }

  const canRequestAdjustments: Gate = {
    ok: Boolean(current) && !adjustmentOnCurrent,
    reasons: !current
      ? ["Ainda não existe versão do artigo."]
      : adjustmentOnCurrent
        ? [`Já existe pedido de ajustes registrado na v${current.number}.`]
        : [],
  };

  const editorialReasons = [...base];
  if (current && !adjustmentOnCurrent && editorialApproval) {
    editorialReasons.push(`A v${current.number} já tem aprovação editorial.`);
  }
  if (openAdjustments.length > 0) {
    editorialReasons.push(
      `${openAdjustments.length} pedido(s) de ajuste em aberto. Marque como resolvidos ao conferir a nova versão.`,
    );
  }
  const canApproveEditorial: Gate = { ok: editorialReasons.length === 0, reasons: editorialReasons };

  const specialistReasons = [...base];
  if (current && !adjustmentOnCurrent && specialistReview) {
    specialistReasons.push(`A v${current.number} já tem revisão do especialista registrada.`);
  }
  const canRegisterSpecialist: Gate = { ok: specialistReasons.length === 0, reasons: specialistReasons };

  const finalReasons = [...base];
  if (current && !adjustmentOnCurrent) {
    if (finalApproval) finalReasons.push(`A v${current.number} já está aprovada para publicação.`);
    if (!editorialApproval) finalReasons.push(`Falta a aprovação editorial da v${current.number}.`);
    if (requiresSpecialistReview && !specialistReview) {
      finalReasons.push(`Falta a revisão do especialista/professor na v${current.number}.`);
    }
  }
  if (openAdjustments.length > 0) finalReasons.push(`${openAdjustments.length} pedido(s) de ajuste em aberto.`);
  if (openQualityFlags.length > 0) {
    const kinds = Array.from(new Set(openQualityFlags.map((f) => (f.kind === "fontes" ? "fontes" : "legibilidade"))));
    finalReasons.push(`Pendência de qualidade em aberto: ${kinds.join(" e ")}.`);
  }
  const canApproveFinal: Gate = { ok: finalReasons.length === 0, reasons: finalReasons };

  const timestamps = [
    article.updatedAt,
    ...all.map((d) => d.createdAt),
    ...ws.comments
      .filter((c) => c.target.kind === "artigo" && c.target.articleId === article.id)
      .map((c) => c.resolvedAt ?? c.createdAt),
  ];
  const lastUpdatedAt = timestamps.sort().at(-1) ?? article.updatedAt;

  return {
    stage,
    current,
    currentDecisions,
    adjustmentOnCurrent,
    editorialApproval,
    specialistReview,
    finalApproval,
    requiresSpecialistReview,
    openAdjustments,
    openQualityFlags,
    historicalApprovals,
    canApproveEditorial,
    canRegisterSpecialist,
    canApproveFinal,
    canRequestAdjustments,
    lastUpdatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Pauta                                                               */
/* ------------------------------------------------------------------ */

export interface PautaState {
  pauta: Pauta;
  decisions: PautaDecision[];
  /** Aprovação válida para a revisão atual da pauta. */
  approvalForCurrentRevision?: PautaDecision;
  /** Aprovação de revisão anterior (a pauta foi alterada depois). */
  supersededApproval?: PautaDecision;
  lastReturn?: PautaDecision;
  canApprove: Gate;
  canReturn: Gate;
  canSubmit: Gate;
}

export function derivePautaState(ws: ProjectWorkspace, pauta: Pauta): PautaState {
  const decisions = getPautaDecisions(ws, pauta.id);
  const approvals = decisions.filter((d) => d.kind === "pauta_aprovada");
  const approvalForCurrentRevision = lastOf(approvals, (d) => d.target.pautaRevision === pauta.revision);
  const supersededApproval = approvalForCurrentRevision
    ? undefined
    : lastOf(approvals, (d) => d.target.pautaRevision < pauta.revision);
  const lastReturn = lastOf(decisions, (d) => d.kind === "pauta_devolvida");

  const approveReasons: string[] = [];
  if (pauta.status === "aprovada") approveReasons.push("A pauta já está aprovada nesta revisão.");
  if (pauta.status === "devolvida") approveReasons.push("A pauta foi devolvida. Ajuste e reenvie para revisão.");
  if (!pauta.title.trim() || !pauta.primaryKeyword.trim()) {
    approveReasons.push("Título e palavra-chave principal são obrigatórios.");
  }
  if (!pauta.briefingMarkdown.trim()) approveReasons.push("O briefing está vazio.");

  const returnReasons: string[] = [];
  if (pauta.status === "aprovada") returnReasons.push("A pauta já foi aprovada. Edite-a para reabrir a revisão.");
  if (pauta.status === "devolvida") returnReasons.push("A pauta já está devolvida.");

  const submitReasons: string[] = [];
  if (pauta.status === "em_revisao") submitReasons.push("A pauta já está em revisão.");
  if (pauta.status === "aprovada") submitReasons.push("A pauta já está aprovada.");

  return {
    pauta,
    decisions,
    approvalForCurrentRevision,
    supersededApproval,
    lastReturn,
    canApprove: { ok: approveReasons.length === 0, reasons: approveReasons },
    canReturn: { ok: returnReasons.length === 0, reasons: returnReasons },
    canSubmit: { ok: submitReasons.length === 0, reasons: submitReasons },
  };
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

export const REVIEW_STAGES: ArticleStage[] = [
  "revisao_editorial",
  "revisao_especialista",
  "aguardando_aprovacao_final",
];

export interface OverviewCounters {
  pautasAwaitingDecision: number;
  articlesAwaitingReview: number;
  openAdjustmentRequests: number;
  articlesWithAdjustments: number;
  articlesApproved: number;
  openQualityFlags: number;
}

export function computeOverview(ws: ProjectWorkspace): OverviewCounters {
  const states = ws.articles.map((a) => deriveArticleState(ws, a));
  const openAdjustments = ws.comments.filter((c) => c.type === "ajuste" && c.status === "aberto");
  return {
    pautasAwaitingDecision: ws.pautas.filter((p) => p.status === "sugerida" || p.status === "em_revisao").length,
    articlesAwaitingReview: states.filter((s) => REVIEW_STAGES.includes(s.stage)).length,
    openAdjustmentRequests: openAdjustments.length,
    articlesWithAdjustments: states.filter((s) => s.stage === "ajustes_solicitados").length,
    articlesApproved: states.filter((s) => s.stage === "aprovado_publicacao").length,
    openQualityFlags: ws.qualityFlags.filter((f) => f.status === "aberta").length,
  };
}

export interface QueueItem {
  key: string;
  kind: "pauta" | "artigo";
  id: string;
  title: string;
  keyword: string;
  stageLabel: string;
  stageKey: string;
  nextAction: string;
  updatedAt: string;
}

export function buildPendingQueue(ws: ProjectWorkspace): QueueItem[] {
  const items: QueueItem[] = [];
  for (const p of ws.pautas) {
    if (p.status === "sugerida" || p.status === "em_revisao" || p.status === "devolvida") {
      items.push({
        key: `p-${p.id}`,
        kind: "pauta",
        id: p.id,
        title: p.title,
        keyword: p.primaryKeyword,
        stageKey: p.status,
        stageLabel: "",
        nextAction:
          p.status === "devolvida" ? "Ajustar a pauta e reenviar" : "Aprovar ou devolver a pauta",
        updatedAt: p.updatedAt,
      });
    }
  }
  for (const a of ws.articles) {
    const s = deriveArticleState(ws, a);
    if (s.stage === "aprovado_publicacao" || s.stage === "publicado") continue;
    const nextAction: Record<ArticleStage, string> = {
      rascunho: "Aguardando redação",
      revisao_editorial: `Revisar a v${s.current?.number ?? "?"}`,
      ajustes_solicitados: "Salvar nova versão com os ajustes",
      revisao_especialista: "Registrar revisão do especialista",
      aguardando_aprovacao_final: "Registrar aprovação final",
      aprovado_publicacao: "",
      publicado: "",
    };
    items.push({
      key: `a-${a.id}`,
      kind: "artigo",
      id: a.id,
      title: a.title,
      keyword: a.primaryKeyword,
      stageKey: s.stage,
      stageLabel: "",
      nextAction: nextAction[s.stage],
      updatedAt: s.lastUpdatedAt,
    });
  }
  return items.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

/** Seções (títulos) do Markdown, para vincular comentários. */
export function extractSections(markdown: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push(m[2]);
  }
  return Array.from(new Set(out));
}

export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ");
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.length;
}
