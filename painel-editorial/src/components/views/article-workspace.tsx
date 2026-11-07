"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bot,
  BookOpenText,
  CheckCircle2,
  Circle,
  FileText,
  GraduationCap,
  History,
  Library,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deriveArticleState, extractSections, type ArticleStage } from "@/domain/rules";
import type { AdjustmentStage, Article, ProjectWorkspace } from "@/domain/types";
import { formatDateTime, plural } from "@/lib/format";
import { ADJUSTMENT_STAGE_LABEL, ARTICLE_STAGE, ROLE_LABEL } from "@/lib/labels";
import { useEditorial, type WorkspaceHandle } from "@/state/editorial";
import { Link } from "@/state/unsaved-guard";
import { MarkdownView } from "@/components/markdown-view";
import {
  DemoTag,
  Dialog,
  Notice,
  PendingIntegrationTag,
  StatusBadge,
  TabPanel,
  Tabs,
  type TabDef,
} from "@/components/ui";
import { ArticleComments } from "./article-comments";
import { ArticleEditor } from "./article-editor";
import { ArticleHistory } from "./article-history";
import { ArticleSources } from "./article-sources";

type TabKey = "artigo" | "briefing" | "comentarios" | "fontes" | "historico";
const TAB_KEYS: TabKey[] = ["artigo", "briefing", "comentarios", "fontes", "historico"];
type DialogKind = "ajustes" | "editorial" | "especialista" | "final" | null;

const NEXT_ACTION: Record<ArticleStage, string> = {
  rascunho: "Iniciar o rascunho (manual) ou aguardar a redação do agente.",
  revisao_editorial: "Revisar o texto e registrar a aprovação editorial ou solicitar ajustes.",
  ajustes_solicitados: "Editar o texto e salvar uma nova versão com os ajustes.",
  revisao_especialista: "Registrar a revisão do especialista/professor.",
  aguardando_aprovacao_final: "Conferir pendências e registrar a aprovação final.",
  aprovado_publicacao: "Publicação: integração pendente. O conteúdo ainda não foi publicado.",
  publicado: "Publicado com confirmação de URL e data.",
};

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />}
      <span className={ok ? "text-ink" : "text-muted"}>
        <span className="sr-only">{ok ? "Concluído: " : "Pendente: "}</span>
        {children}
      </span>
    </li>
  );
}

export function ArticleWorkspace({ ws, article, execute }: { ws: ProjectWorkspace; article: Article; execute: WorkspaceHandle["execute"] }) {
  const { drafts, settings, activeReviewer } = useEditorial();
  const state = useMemo(() => deriveArticleState(ws, article), [ws, article]);
  const current = state.current;
  const pauta = ws.pautas.find((p) => p.id === article.pautaId);
  const base = `/p/${ws.project.id}`;

  const sp = useSearchParams();
  const pathname = usePathname() ?? "";
  const tabParam = sp?.get("aba") as TabKey | null;
  const urlTab: TabKey = tabParam && TAB_KEYS.includes(tabParam) ? tabParam : "artigo";
  // Estado local para resposta imediata; a URL acompanha (links diretos para uma aba).
  const [tab, setTabState] = useState<TabKey>(urlTab);
  useEffect(() => setTabState(urlTab), [urlTab]);
  const setTab = (k: TabKey) => {
    setTabState(k);
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (k === "artigo") next.delete("aba");
    else next.set("aba", k);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const [editingDirty, setEditingDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setEditingDirty(d), []);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [comment, setComment] = useState("");
  const [adjStage, setAdjStage] = useState<AdjustmentStage>("redacao");
  const [adjSection, setAdjSection] = useState("");
  const [specOutcome, setSpecOutcome] = useState<"aprovado" | "aprovado_com_observacoes">("aprovado");
  const specialists = settings?.reviewers.filter((r) => r.role === "especialista") ?? [];
  const [specialistId, setSpecialistId] = useState("");
  const [busy, setBusy] = useState(false);
  const sections = useMemo(() => (current ? extractSections(current.markdown) : []), [current]);

  const openComments = ws.comments.filter((c) => c.target.kind === "artigo" && c.target.articleId === article.id && c.status === "aberto").length;
  const tabs: TabDef<TabKey>[] = [
    { key: "artigo", label: "Artigo", icon: FileText },
    { key: "briefing", label: "Briefing", icon: BookOpenText },
    { key: "comentarios", label: "Comentários e ajustes", icon: MessageSquare, count: openComments + state.openQualityFlags.length },
    { key: "fontes", label: "Fontes utilizadas", icon: Library },
    { key: "historico", label: "Histórico", icon: History, count: article.versions.length },
  ];

  const close = () => {
    setDialog(null);
    setComment("");
    setAdjSection("");
  };

  const open = (k: Exclude<DialogKind, null>) => {
    if (k === "especialista") {
      const preferred = activeReviewer?.role === "especialista" ? activeReviewer.id : specialists[0]?.id ?? "";
      setSpecialistId(preferred);
    }
    setDialog(k);
  };

  const confirm = async () => {
    if (!current || !dialog) return;
    setBusy(true);
    let r;
    if (dialog === "ajustes") {
      r = await execute({ type: "article.requestAdjustments", articleId: article.id, versionId: current.id, justification: comment, stage: adjStage, section: adjSection });
    } else if (dialog === "editorial") {
      r = await execute({ type: "article.approveEditorial", articleId: article.id, versionId: current.id, comment });
    } else if (dialog === "especialista") {
      r = await execute({ type: "article.specialistReview", articleId: article.id, versionId: current.id, outcome: specOutcome, comment }, { actorId: specialistId });
    } else {
      r = await execute({ type: "article.approveFinal", articleId: article.id, versionId: current.id, comment });
    }
    setBusy(false);
    if (r.ok) close();
  };

  const dirtyReason = "Salve ou descarte as alterações do texto antes: decisões valem para a versão salva.";
  const actorIsSpecialist = activeReviewer?.role === "especialista";
  const gate = (ok: boolean, reasons: string[]) => ({ disabled: !ok || editingDirty, title: editingDirty ? dirtyReason : reasons.join(" ") });

  return (
    <div className="mx-auto max-w-[1400px]">
      <Link href={`${base}/artigos`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Artigos
      </Link>

      <header className="card mb-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
          <span className="font-medium uppercase tracking-wide">{ws.project.name}</span>
          <span aria-hidden>·</span>
          <span>Artigo</span>
          {article.isDemo ? <DemoTag>Rascunho demonstrativo</DemoTag> : null}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{article.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge meta={ARTICLE_STAGE[state.stage]} />
          <span className="text-muted">
            Palavra-chave: <strong className="font-medium text-ink">{article.primaryKeyword}</strong>
          </span>
          <span className="text-muted">
            Versão atual: <strong className="font-medium text-ink">{current ? `v${current.number}` : "nenhuma"}</strong>
            {current ? <span className="text-faint"> · {formatDateTime(current.createdAt)}</span> : null}
          </span>
          {state.openQualityFlags.map((f) => (
            <span key={f.id} className="chip border-amber-300 bg-amber-50 text-amber-950">
              <TriangleAlert className="h-3 w-3" aria-hidden /> Pendência: {f.kind}
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-ink">Próxima ação:</span> {NEXT_ACTION[state.stage]}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-line pt-3 sm:flex sm:flex-wrap sm:gap-2 [&>button]:max-sm:whitespace-normal [&>button]:max-sm:px-2 [&>button]:max-sm:text-xs [&>button]:max-sm:leading-tight">
          <button type="button" className="btn-secondary" onClick={() => open("ajustes")} {...gate(state.canRequestAdjustments.ok, state.canRequestAdjustments.reasons)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Solicitar ajustes
          </button>
          <button type="button" className="btn-secondary" onClick={() => open("editorial")} {...gate(state.canApproveEditorial.ok && !actorIsSpecialist, actorIsSpecialist ? ["Troque a identidade local para um editor ou gestor."] : state.canApproveEditorial.reasons)}>
            <Send className="h-4 w-4" aria-hidden /> Aprovar para próxima etapa
          </button>
          <button type="button" className="btn-secondary" onClick={() => open("especialista")} {...gate(state.canRegisterSpecialist.ok, state.canRegisterSpecialist.reasons)}>
            <GraduationCap className="h-4 w-4" aria-hidden /> Registrar revisão do especialista
          </button>
          <button type="button" className="btn-primary" onClick={() => open("final")} {...gate(state.canApproveFinal.ok && !actorIsSpecialist, actorIsSpecialist ? ["Troque a identidade local para um editor ou gestor."] : state.canApproveFinal.reasons)}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> Aprovação final
          </button>
          <span className="col-span-2 inline-flex items-center gap-1.5 sm:ml-auto">
            <button type="button" className="btn-secondary" disabled title="A publicação no site (Astro) ainda não está integrada.">
              <UploadCloud className="h-4 w-4" aria-hidden /> Publicar
            </button>
            <PendingIntegrationTag />
          </span>
        </div>
        {editingDirty ? <p className="mt-2 text-xs font-medium text-amber-800">{dirtyReason}</p> : null}
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Tabs tabs={tabs} active={tab} onChange={setTab} idPrefix="art" label="Áreas do artigo" />
          <div className="pt-4">
            <div hidden={tab !== "artigo"}>
              <TabPanel idPrefix="art" tabKey="artigo">
                <ArticleEditor ws={ws} article={article} state={state} drafts={drafts} execute={execute} onDirtyChange={onDirtyChange} />
              </TabPanel>
            </div>
            {tab === "briefing" ? (
              <TabPanel idPrefix="art" tabKey="briefing">
                {current ? (
                  <div className="flex flex-col gap-4">
                    <Notice tone="info">
                      Direção editorial que originou a v{current.number}: revisão {current.briefing.pautaRevision} da pauta, capturada em {formatDateTime(current.briefing.capturedAt)}.
                      {pauta && pauta.revision !== current.briefing.pautaRevision ? ` A pauta está hoje na revisão ${pauta.revision}.` : ""}
                      {pauta ? <> <Link className="font-medium underline" href={`${base}/pautas/${pauta.id}`}>Abrir pauta</Link></> : null}
                    </Notice>
                    <div className="card grid gap-3 px-4 py-3 sm:grid-cols-3">
                      <div><p className="text-xs font-medium uppercase tracking-wide text-faint">Intenção</p><p className="text-sm capitalize">{current.briefing.intent}</p></div>
                      <div><p className="text-xs font-medium uppercase tracking-wide text-faint">Público</p><p className="text-sm">{current.briefing.audience || "—"}</p></div>
                      <div><p className="text-xs font-medium uppercase tracking-wide text-faint">Dúvida que resolve</p><p className="text-sm">{current.briefing.question || "—"}</p></div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="card px-4 py-3">
                        <h3 className="mb-2 text-sm font-semibold">Briefing</h3>
                        {current.briefing.briefingMarkdown.trim() ? <MarkdownView markdown={current.briefing.briefingMarkdown} variant="compact" /> : <p className="text-sm text-faint">Vazio.</p>}
                      </section>
                      <section className="card px-4 py-3">
                        <h3 className="mb-2 text-sm font-semibold">Tópicos previstos</h3>
                        {current.briefing.outlineMarkdown.trim() ? <MarkdownView markdown={current.briefing.outlineMarkdown} variant="compact" /> : <p className="text-sm text-faint">Vazio.</p>}
                        <h3 className="mb-1 mt-4 text-sm font-semibold">Links internos previstos</h3>
                        {current.briefing.plannedLinks.length === 0 ? (
                          <p className="text-sm text-faint">Nenhum.</p>
                        ) : (
                          <ul className="flex flex-col gap-1 text-sm">
                            {current.briefing.plannedLinks.map((l) => (
                              <li key={l.id}>
                                {l.anchor} → <code className="rounded bg-subtle px-1 text-xs">{l.url}</code>
                                {current.markdown.includes(`](${l.url})`) ? <span className="ml-1 text-xs text-emerald-800">(presente no texto)</span> : <span className="ml-1 text-xs text-amber-800">(não encontrado no texto)</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>
                  </div>
                ) : pauta ? (
                  <div className="card px-4 py-3">
                    <p className="mb-2 text-sm text-muted">Ainda não há versão. Briefing atual da pauta (revisão {pauta.revision}):</p>
                    <MarkdownView markdown={pauta.briefingMarkdown} variant="compact" />
                  </div>
                ) : null}
              </TabPanel>
            ) : null}
            {tab === "comentarios" ? (
              <TabPanel idPrefix="art" tabKey="comentarios">
                <ArticleComments ws={ws} article={article} state={state} execute={execute} onRequestAdjustments={() => open("ajustes")} editingDirty={editingDirty} />
              </TabPanel>
            ) : null}
            {tab === "fontes" ? (
              <TabPanel idPrefix="art" tabKey="fontes">
                {current ? <ArticleSources ws={ws} article={article} version={current} /> : <p className="text-sm text-faint">Sem versão, não há execução associada.</p>}
              </TabPanel>
            ) : null}
            {tab === "historico" ? (
              <TabPanel idPrefix="art" tabKey="historico">
                {article.versions.length ? <ArticleHistory ws={ws} article={article} state={state} /> : <p className="text-sm text-faint">Nenhuma versão ainda.</p>}
              </TabPanel>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="card px-4 py-3" aria-labelledby="req-title">
            <h2 id="req-title" className="text-sm font-semibold">Requisitos para aprovação final{current ? ` da v${current.number}` : ""}</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              <CheckItem ok={Boolean(current) && !state.adjustmentOnCurrent}>Versão sem pedido de ajustes</CheckItem>
              <CheckItem ok={Boolean(state.editorialApproval)}>
                Aprovação editorial
                {state.editorialApproval ? <span className="block text-xs text-faint">{state.editorialApproval.reviewerName} · {formatDateTime(state.editorialApproval.createdAt)}</span> : null}
              </CheckItem>
              {state.requiresSpecialistReview ? (
                <CheckItem ok={Boolean(state.specialistReview)}>
                  Revisão do especialista/professor
                  {state.specialistReview ? <span className="block text-xs text-faint">{state.specialistReview.reviewerName} · {formatDateTime(state.specialistReview.createdAt)}</span> : null}
                </CheckItem>
              ) : null}
              <CheckItem ok={state.openAdjustments.length === 0}>Pedidos de ajuste resolvidos{state.openAdjustments.length ? ` (${plural(state.openAdjustments.length, "aberto", "abertos")})` : ""}</CheckItem>
              <CheckItem ok={state.openQualityFlags.length === 0}>Pendências de legibilidade e fontes resolvidas</CheckItem>
            </ul>
            {state.finalApproval ? (
              <Notice tone="success" icon={ShieldCheck} className="mt-3">
                Aprovado para publicação por {state.finalApproval.reviewerName} em {formatDateTime(state.finalApproval.createdAt)} (v{state.finalApproval.target.versionNumber}). Não publicado.
              </Notice>
            ) : null}
            {state.historicalApprovals.length > 0 ? (
              <p className="mt-3 text-xs text-muted">
                {state.historicalApprovals.length} decisão(ões) de aprovação em versões anteriores — válidas somente no histórico.
              </p>
            ) : null}
          </section>

          {current?.aiReview ? (
            <section className="card border-dashed px-4 py-3" aria-labelledby="ai-title">
              <h2 id="ai-title" className="flex items-center gap-1.5 text-sm font-semibold">
                <Bot className="h-4 w-4" aria-hidden /> Parecer auxiliar do revisor de IA
              </h2>
              <div className="mt-1 flex flex-wrap gap-2">
                {current.aiReview.isDemo ? <DemoTag>Parecer simulado</DemoTag> : null}
              </div>
              <p className="mt-2 text-sm text-muted">{current.aiReview.summary}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {current.aiReview.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-faint">Informação auxiliar. Não preenche aprovação humana nem revisão do professor.</p>
            </section>
          ) : current && current.basedOnVersionId ? (
            <p className="text-xs text-faint">O parecer de IA, quando existe, refere-se à versão gerada pelo agente; esta versão foi editada por uma pessoa.</p>
          ) : null}

          {pauta ? (
            <section className="card px-4 py-3">
              <h2 className="text-sm font-semibold">Pauta de origem</h2>
              <Link href={`${base}/pautas/${pauta.id}`} className="mt-1 block text-sm text-brand-800 hover:underline">{pauta.title}</Link>
              <p className="text-xs text-faint">Revisão {pauta.revision}. A aprovação da pauta não aprova este artigo.</p>
            </section>
          ) : null}
        </aside>
      </div>

      {/* Diálogos de decisão */}
      <Dialog
        open={dialog === "ajustes"}
        onClose={close}
        title={`Solicitar ajustes na v${current?.number ?? ""}`}
        description="A versão sai da condição de aprovação. Será preciso salvar uma nova versão."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={busy || !comment.trim()} onClick={() => void confirm()}>Registrar solicitação</button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {state.finalApproval ? (
            <Notice tone="warning" icon={TriangleAlert}>Esta versão está aprovada para publicação. Solicitar ajustes retira essa condição.</Notice>
          ) : null}
          <div>
            <label htmlFor="adj-just" className="field-label">Justificativa <span className="text-red-700">*</span></label>
            <textarea id="adj-just" className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="adj-stage" className="field-label">Etapa responsável</label>
              <select id="adj-stage" className="input" value={adjStage} onChange={(e) => setAdjStage(e.target.value as AdjustmentStage)}>
                {Object.entries(ADJUSTMENT_STAGE_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="adj-section" className="field-label">Seção (opcional)</label>
              <select id="adj-section" className="input" value={adjSection} onChange={(e) => setAdjSection(e.target.value)}>
                <option value="">Geral</option>
                {sections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            Será registrada na demonstração. Envio ao agente da etapa escolhida: <PendingIntegrationTag />
          </p>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "editorial"}
        onClose={close}
        title={`Aprovar a v${current?.number ?? ""} para a próxima etapa`}
        description={state.requiresSpecialistReview ? "Próxima etapa: revisão do especialista/professor." : "Próxima etapa: aprovação final."}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void confirm()}>Registrar aprovação editorial</button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {state.openQualityFlags.length ? (
            <Notice tone="warning" icon={TriangleAlert}>
              Há {state.openQualityFlags.length} pendência(s) de qualidade em aberto. A aprovação editorial é possível, mas a aprovação final ficará bloqueada até a resolução.
            </Notice>
          ) : null}
          <p className="text-sm text-muted">
            Registrado como <strong className="text-ink">{activeReviewer?.name}</strong> ({activeReviewer ? ROLE_LABEL[activeReviewer.role] : ""}) — identificação local.
          </p>
          <div>
            <label htmlFor="ed-comment" className="field-label">Comentário (opcional)</label>
            <textarea id="ed-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "especialista"}
        onClose={close}
        title={`Revisão do especialista — v${current?.number ?? ""}`}
        description="Para pedir mudanças, use “Solicitar ajustes”. O parecer de IA não substitui esta revisão."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={busy || !comment.trim() || !specialistId} onClick={() => void confirm()}>Registrar revisão</button>
          </>
        }
      >
        {specialists.length === 0 ? (
          <Notice tone="warning">Nenhuma identidade com papel de especialista/professor. Cadastre uma em Configurações → Modo demonstração.</Notice>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="spec-who" className="field-label">Quem revisou</label>
              <select id="spec-who" className="input" value={specialistId} onChange={(e) => setSpecialistId(e.target.value)}>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="field-hint">Identificação local da demonstração, sem autenticação.</p>
            </div>
            <fieldset>
              <legend className="field-label">Resultado</legend>
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="spec-outcome" checked={specOutcome === "aprovado"} onChange={() => setSpecOutcome("aprovado")} /> Aprovado
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="spec-outcome" checked={specOutcome === "aprovado_com_observacoes"} onChange={() => setSpecOutcome("aprovado_com_observacoes")} /> Aprovado com observações
                </label>
              </div>
            </fieldset>
            <div>
              <label htmlFor="spec-comment" className="field-label">Comentário do especialista <span className="text-red-700">*</span></label>
              <textarea id="spec-comment" className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={dialog === "final"}
        onClose={close}
        title={`Aprovação final da v${current?.number ?? ""}`}
        description="Produz o estado “Aprovado para publicação”. Não publica o conteúdo."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={close}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={busy || !state.canApproveFinal.ok} onClick={() => void confirm()}>Aprovar para publicação</button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Registrado como <strong className="text-ink">{activeReviewer?.name}</strong> — identificação local. Se o texto mudar depois, a nova versão volta para revisão e esta aprovação fica somente no histórico.
          </p>
          <div>
            <label htmlFor="final-comment" className="field-label">Comentário (opcional)</label>
            <textarea id="final-comment" className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
      </Dialog>

      <div className={clsx("sr-only")} aria-live="polite">
        Etapa atual: {ARTICLE_STAGE[state.stage].label}
      </div>
    </div>
  );
}
