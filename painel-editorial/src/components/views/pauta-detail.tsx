"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  History,
  Info,
  MessageSquare,
  Pencil,
  Send,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { derivePautaState } from "@/domain/rules";
import type { Pauta, PautaDecision, ProjectWorkspace } from "@/domain/types";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { INTENT_LABEL, PAUTA_STATUS, PRIORITY_LABEL, ROLE_LABEL } from "@/lib/labels";
import type { WorkspaceHandle } from "@/state/editorial";
import { Link } from "@/state/unsaved-guard";
import { MarkdownView } from "@/components/markdown-view";
import {
  DemoTag,
  Dialog,
  EmptyState,
  KeyValue,
  Notice,
  PageHeader,
  PendingIntegrationTag,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import { PautaForm, pautaToInput } from "./pauta-form";

const DECISION_LABEL: Record<PautaDecision["kind"], string> = {
  pauta_aprovada: "Pauta aprovada",
  pauta_devolvida: "Pauta devolvida",
  pauta_enviada_revisao: "Enviada para revisão",
};

function safeHttpUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function PautaDetail({ ws, pauta, execute }: { ws: ProjectWorkspace; pauta: Pauta; execute: WorkspaceHandle["execute"] }) {
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"aprovar" | "devolver" | null>(null);
  const [comment, setComment] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);
  const st = useMemo(() => derivePautaState(ws, pauta), [ws, pauta]);
  const base = `/p/${ws.project.id}`;
  const clusters = useMemo(() => Array.from(new Set(ws.pautas.map((p) => p.cluster).filter(Boolean))).sort(), [ws.pautas]);
  const initial = useMemo(() => pautaToInput(pauta), [pauta]);
  const comments = ws.comments
    .filter((c) => c.target.kind === "pauta" && c.target.pautaId === pauta.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const article = pauta.articleId ? ws.articles.find((a) => a.id === pauta.articleId) : undefined;

  const closeDialog = () => {
    setDialog(null);
    setComment("");
  };

  const decide = async () => {
    if (!dialog) return;
    setBusy(true);
    const r =
      dialog === "aprovar"
        ? await execute({ type: "pauta.approve", pautaId: pauta.id, comment })
        : await execute({ type: "pauta.return", pautaId: pauta.id, comment });
    setBusy(false);
    if (r.ok) closeDialog();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`${base}/pautas`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Pautas
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {ws.project.name} · Pauta · revisão {pauta.revision}
            {pauta.isDemo ? <DemoTag>Sugestão demonstrativa</DemoTag> : null}
          </span>
        }
        title={pauta.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge meta={PAUTA_STATUS[pauta.status]} />
            <span>
              Palavra-chave: <strong className="font-medium text-ink">{pauta.primaryKeyword}</strong>
            </span>
          </span>
        }
        actions={
          editing ? null : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden /> Editar
              </button>
              {st.canSubmit.ok ? (
                <button type="button" className="btn-secondary" onClick={() => void execute({ type: "pauta.submit", pautaId: pauta.id })}>
                  <Send className="h-4 w-4" aria-hidden /> {pauta.status === "devolvida" ? "Reenviar para revisão" : "Iniciar revisão"}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" disabled={!st.canReturn.ok} title={st.canReturn.reasons.join(" ")} onClick={() => setDialog("devolver")}>
                <Undo2 className="h-4 w-4" aria-hidden /> Devolver
              </button>
              <button type="button" className="btn-primary" disabled={!st.canApprove.ok} title={st.canApprove.reasons.join(" ")} onClick={() => setDialog("aprovar")}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Aprovar pauta
              </button>
            </>
          )
        }
      />

      {st.supersededApproval && pauta.status !== "aprovada" ? (
        <Notice tone="warning" icon={History} className="mb-4" title="Pauta alterada depois de aprovada">
          A aprovação da revisão {st.supersededApproval.target.pautaRevision} ({formatDateTime(st.supersededApproval.createdAt)}, {st.supersededApproval.reviewerName}) permanece no histórico, mas não vale para a revisão {pauta.revision}.
        </Notice>
      ) : null}
      {pauta.status === "devolvida" && st.lastReturn ? (
        <Notice tone="warning" icon={Undo2} className="mb-4" title="Devolvida com comentário">
          “{st.lastReturn.comment}” — {st.lastReturn.reviewerName}, {formatDateTime(st.lastReturn.createdAt)}. Edite a pauta e reenvie para revisão.
        </Notice>
      ) : null}
      {!editing && !st.canApprove.ok && pauta.status !== "aprovada" && pauta.status !== "devolvida" ? (
        <Notice tone="info" icon={Info} className="mb-4">{st.canApprove.reasons.join(" ")}</Notice>
      ) : null}

      {editing ? (
        <PautaForm
          guardKey={`pauta-${pauta.id}`}
          initial={initial}
          clusters={clusters}
          submitLabel={pauta.status === "aprovada" ? "Salvar (volta para revisão)" : "Salvar alterações"}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const r = await execute({ type: "pauta.update", pautaId: pauta.id, patch: input });
            if (r.ok) setEditing(false);
            return r.ok;
          }}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            <SectionCard title="Briefing" description="Direção editorial para a redação.">
              {pauta.briefingMarkdown.trim() ? <MarkdownView markdown={pauta.briefingMarkdown} variant="compact" /> : <EmptyState title="Briefing vazio." action={<button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(true)}>Escrever briefing</button>} />}
            </SectionCard>
            <SectionCard title="Estrutura sugerida">
              {pauta.outlineMarkdown.trim() ? <MarkdownView markdown={pauta.outlineMarkdown} variant="compact" /> : <p className="text-sm text-faint">Sem estrutura definida.</p>}
            </SectionCard>
            <SectionCard title="Links internos previstos">
              {pauta.plannedLinks.length === 0 ? (
                <p className="text-sm text-faint">Nenhum link interno previsto.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {pauta.plannedLinks.map((l) => (
                    <li key={l.id}>
                      <span className="font-medium">{l.anchor || "(sem âncora)"}</span> → <code className="rounded bg-subtle px-1 text-xs">{l.url}</code>
                      {l.note ? <span className="text-xs text-muted"> · {l.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Evidências de pesquisa" description="Nenhuma ferramenta de pesquisa de palavras-chave está conectada.">
              {pauta.researchEvidence.length === 0 ? (
                <p className="text-sm text-faint">Nenhuma evidência registrada. <PendingIntegrationTag /></p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pauta.researchEvidence.map((e) => {
                    const url = safeHttpUrl(e.url);
                    return (
                      <li key={e.id} className="rounded-md border border-line px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-medium text-ink">{e.source || "Origem não informada"}</span>
                          <span>· {e.locality || "localidade não informada"}</span>
                          <span>· coleta {formatCalendarDate(e.collectedAt)}</span>
                          {e.isDemo ? <DemoTag /> : null}
                        </div>
                        <p className="mt-1">{e.summary}</p>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                            Abrir origem <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Conteúdo existente relacionado" description="Sobreposição só é afirmada quando avaliada por uma pessoa.">
              {pauta.relatedContent.length === 0 ? (
                <p className="text-sm text-faint">Nenhum conteúdo relacionado registrado. A verificação automática de sobreposição não existe nesta entrega.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pauta.relatedContent.map((r) => {
                    const url = safeHttpUrl(r.url);
                    return (
                      <li key={r.id} className="rounded-md border border-line px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.title}</span>
                          {r.overlap === "simulada" ? <DemoTag>Sobreposição simulada — sem auditoria real</DemoTag> : r.overlap === "avaliada_manualmente" ? <span className="chip border-line-strong text-muted">Avaliada manualmente</span> : <span className="chip border-line-strong text-muted">Não avaliada</span>}
                        </div>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mt-0.5 inline-flex max-w-full items-center gap-1 break-all text-xs text-brand-700 hover:underline">
                            {r.url} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                          </a>
                        ) : (
                          <p className="text-xs text-muted">{r.url}</p>
                        )}
                        {r.note ? <p className="mt-1 text-muted">{r.note}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            {article ? (
              <SectionCard title="Artigo desta pauta">
                <Link href={`${base}/artigos/${article.id}`} className="btn-secondary w-full">
                  <FileText className="h-4 w-4" aria-hidden /> Abrir artigo
                </Link>
                <p className="mt-2 text-xs text-muted">A aprovação da pauta não aprova o artigo. O artigo tem revisão e aprovação próprias, por versão.</p>
              </SectionCard>
            ) : null}
            <SectionCard title="Dados da pauta">
              <dl className="grid gap-3">
                <KeyValue label="Intenção de busca">{INTENT_LABEL[pauta.intent]}</KeyValue>
                <KeyValue label="Público">{pauta.audience || "—"}</KeyValue>
                <KeyValue label="Dúvida que resolve">{pauta.question || "—"}</KeyValue>
                <KeyValue label="Cluster / tema">{pauta.cluster || "—"}</KeyValue>
                <KeyValue label="Palavras-chave secundárias">{pauta.secondaryKeywords.length ? pauta.secondaryKeywords.join(", ") : "—"}</KeyValue>
                <KeyValue label="Justificativa">{pauta.rationale || "—"}</KeyValue>
                <KeyValue label="Contribuição para a cobertura">{pauta.coverageContribution || "—"}</KeyValue>
                <KeyValue label="Prioridade">{PRIORITY_LABEL[pauta.priority]}</KeyValue>
                <KeyValue label="Responsável">{pauta.owner || "Não definido"}</KeyValue>
                <KeyValue label="Data editorial planejada">
                  {pauta.plannedDate ? `${formatCalendarDate(pauta.plannedDate)} (planejamento, sem agendamento)` : "Não definida"}
                </KeyValue>
                <KeyValue label="Origem">{pauta.origin.label}</KeyValue>
                <KeyValue label="Atualizada em">{formatDateTime(pauta.updatedAt)}</KeyValue>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-muted">
                Pedir nova sugestão ao Planejador <PendingIntegrationTag />
              </div>
            </SectionCard>

            <SectionCard title="Decisões" description="Cada decisão referencia a revisão da pauta.">
              {st.decisions.length === 0 ? (
                <p className="text-sm text-faint">Nenhuma decisão registrada.</p>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {[...st.decisions].reverse().map((d) => (
                    <li key={d.id} className="text-sm">
                      <p className="font-medium">
                        {DECISION_LABEL[d.kind]} <span className="font-normal text-muted">· rev. {d.target.pautaRevision}</span>
                        {d.kind === "pauta_aprovada" && d.target.pautaRevision !== pauta.revision ? (
                          <span className="ml-1 text-xs font-normal text-amber-800">(somente histórico)</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted">
                        {d.reviewerName} ({ROLE_LABEL[d.reviewerRole]}) · {formatDateTime(d.createdAt)}
                      </p>
                      {d.comment ? <p className="mt-0.5 text-muted">“{d.comment}”</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            <SectionCard title={<span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4" aria-hidden /> Comentários</span>}>
              <form
                className="mb-3 flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await execute({ type: "comment.addToPauta", pautaId: pauta.id, body: newComment });
                  if (r.ok) setNewComment("");
                }}
              >
                <label htmlFor="pauta-comentario" className="sr-only">Novo comentário</label>
                <textarea id="pauta-comentario" className="input" rows={2} placeholder="Escreva um comentário" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                <button type="submit" className="btn-secondary btn-sm self-end" disabled={!newComment.trim()}>
                  Comentar
                </button>
              </form>
              {comments.length === 0 ? (
                <p className="text-sm text-faint">Sem comentários.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {comments.map((c) => (
                    <li key={c.id} className="text-sm">
                      <p>{c.body}</p>
                      <p className="text-xs text-faint">{c.authorName} · {formatDateTime(c.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </aside>
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onClose={closeDialog}
        title={dialog === "aprovar" ? "Aprovar pauta" : "Devolver pauta"}
        description={
          dialog === "aprovar"
            ? `A decisão vale para a revisão ${pauta.revision}. Aprovar a pauta não aprova o futuro artigo.`
            : "Explique o que precisa mudar. O comentário fica registrado na pauta."
        }
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={closeDialog}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || (dialog === "devolver" && !comment.trim())}
              onClick={() => void decide()}
            >
              {dialog === "aprovar" ? "Aprovar pauta" : "Devolver com comentário"}
            </button>
          </>
        }
      >
        <label htmlFor="pauta-decisao-comentario" className="field-label">
          {dialog === "aprovar" ? "Comentário (opcional)" : "Comentário de devolução"}
          {dialog === "devolver" ? <span className="text-red-700"> *</span> : null}
        </label>
        <textarea id="pauta-decisao-comentario" className="input" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
        {dialog === "devolver" ? <p className="field-hint">Devolução registrada na demonstração. Envio ao agente Planejador: integração pendente.</p> : null}
      </Dialog>
    </div>
  );
}
