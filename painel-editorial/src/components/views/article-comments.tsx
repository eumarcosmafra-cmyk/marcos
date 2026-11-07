"use client";

import clsx from "clsx";
import { CheckCircle2, CircleDot, MessageSquare, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { ArticleState } from "@/domain/rules";
import { extractSections } from "@/domain/rules";
import type { Article, Comment, ProjectWorkspace, QualityFlag } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { ADJUSTMENT_STAGE_LABEL } from "@/lib/labels";
import type { WorkspaceHandle } from "@/state/editorial";
import { DemoTag, Dialog, ToneChip } from "@/components/ui";

type Filter = "abertos" | "resolvidos" | "todos";

export function ArticleComments({
  ws,
  article,
  state,
  execute,
  onRequestAdjustments,
  editingDirty,
}: {
  ws: ProjectWorkspace;
  article: Article;
  state: ArticleState;
  execute: WorkspaceHandle["execute"];
  onRequestAdjustments: () => void;
  editingDirty: boolean;
}) {
  const current = state.current;
  const [body, setBody] = useState("");
  const [section, setSection] = useState("");
  const [filter, setFilter] = useState<Filter>("abertos");
  const [resolving, setResolving] = useState<{ kind: "comment"; item: Comment } | { kind: "flag"; item: QualityFlag } | null>(null);
  const [note, setNote] = useState("");
  const sections = useMemo(() => (current ? extractSections(current.markdown) : []), [current]);

  const comments = ws.comments
    .filter((c) => c.target.kind === "artigo" && c.target.articleId === article.id)
    .filter((c) => (filter === "todos" ? true : filter === "abertos" ? c.status === "aberto" : c.status === "resolvido"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const flags = ws.qualityFlags.filter((f) => f.articleId === article.id).sort((a, b) => (a.status === b.status ? 0 : a.status === "aberta" ? -1 : 1));
  const runOf = (id?: string) => ws.runs.find((r) => r.id === id);

  const versionNumber = (id?: string) => article.versions.find((v) => v.id === id)?.number;

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const r = await execute({ type: "comment.add", articleId: article.id, versionId: current.id, body, section });
    if (r.ok) {
      setBody("");
      setSection("");
    }
  };

  const resolve = async () => {
    if (!resolving) return;
    const r =
      resolving.kind === "comment"
        ? await execute({ type: "comment.resolve", commentId: resolving.item.id, note })
        : await execute({ type: "quality.resolve", flagId: resolving.item.id, note });
    if (r.ok) {
      setResolving(null);
      setNote("");
    }
  };

  const noteRequired = resolving?.kind === "flag" || (resolving?.kind === "comment" && resolving.item.type === "ajuste");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Filtrar comentários">
            {(["abertos", "resolvidos", "todos"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={clsx("rounded px-2 py-1 text-xs font-medium capitalize", filter === f ? "bg-brand-700 text-white" : "text-muted hover:bg-subtle")}
              >
                {f}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={onRequestAdjustments} disabled={!state.canRequestAdjustments.ok || editingDirty} title={editingDirty ? "Salve ou descarte as alterações do texto antes." : state.canRequestAdjustments.reasons.join(" ")}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Solicitar ajustes
          </button>
        </div>

        {comments.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-sm text-faint">
            {filter === "abertos" ? "Nenhum comentário ou ajuste em aberto." : "Nada para mostrar neste filtro."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {comments.map((c) => {
              if (c.target.kind !== "artigo") return null;
              const isAdj = c.type === "ajuste";
              return (
                <li key={c.id} className={clsx("rounded-md border px-3 py-2.5", isAdj ? "border-amber-300 bg-amber-50/40" : "border-line bg-surface")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isAdj ? (
                      <ToneChip tone="warning" icon={RotateCcw}>Pedido de ajuste · etapa: {c.adjustmentStage ? ADJUSTMENT_STAGE_LABEL[c.adjustmentStage] : "—"}</ToneChip>
                    ) : (
                      <ToneChip tone="neutral" icon={MessageSquare}>Observação</ToneChip>
                    )}
                    {c.status === "aberto" ? (
                      <ToneChip tone="info" icon={CircleDot}>Aberto</ToneChip>
                    ) : (
                      <ToneChip tone="success" icon={CheckCircle2}>Resolvido</ToneChip>
                    )}
                    <span className="text-xs text-muted">v{c.target.versionNumber} · {c.section ? `Seção: ${c.section}` : "Geral"}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.body}</p>
                  <p className="mt-1 text-xs text-faint">{c.authorName} · {formatDateTime(c.createdAt)}</p>
                  {c.status === "resolvido" ? (
                    <p className="mt-1 text-xs text-muted">
                      Resolvido por {c.resolvedBy} em {formatDateTime(c.resolvedAt)}
                      {versionNumber(c.resolvedInVersionId) ? ` (conferido na v${versionNumber(c.resolvedInVersionId)})` : ""}
                      {c.resolutionNote ? ` — “${c.resolutionNote}”` : ""}
                    </p>
                  ) : (
                    <button type="button" className="btn-ghost btn-sm mt-1 -ml-2" onClick={() => setResolving({ kind: "comment", item: c })}>
                      Marcar como resolvido
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <form onSubmit={submitComment} className="card flex flex-col gap-2 px-4 py-3">
          <h3 className="text-sm font-semibold">Novo comentário na v{current?.number ?? "—"}</h3>
          <div>
            <label htmlFor="com-section" className="mb-0.5 block text-xs text-muted">Vincular a uma seção</label>
            <select id="com-section" className="input py-1.5" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">Observação geral</option>
              {sections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="com-body" className="sr-only">Comentário</label>
            <textarea id="com-body" className="input" rows={3} placeholder="Escreva a observação" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="text-xs text-faint">Comentários não mudam a etapa. Para devolver a versão, use “Solicitar ajustes”.</p>
          <button type="submit" className="btn-secondary btn-sm self-end" disabled={!body.trim() || !current}>
            Registrar comentário
          </button>
        </form>

        <section className="card" aria-labelledby="qf-title">
          <div className="border-b border-line px-4 py-3">
            <h3 id="qf-title" className="flex items-center gap-1.5 text-sm font-semibold">
              <TriangleAlert className="h-4 w-4 text-amber-700" aria-hidden /> Pendências de qualidade
            </h3>
            <p className="text-xs text-muted">Separadas do estado editorial. Pendências abertas bloqueiam a aprovação final; só uma pessoa as resolve.</p>
          </div>
          {flags.length === 0 ? (
            <p className="px-4 py-3 text-sm text-faint">Nenhuma pendência de legibilidade ou fontes registrada.</p>
          ) : (
            <ul className="flex flex-col">
              {flags.map((f) => (
                <li key={f.id} className="border-b border-line px-4 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneChip tone={f.status === "aberta" ? "warning" : "success"} icon={f.status === "aberta" ? TriangleAlert : CheckCircle2}>
                      {f.kind === "fontes" ? "Fontes" : "Legibilidade"} · {f.status}
                    </ToneChip>
                    {f.isDemo ? <DemoTag /> : null}
                  </div>
                  {f.reasons.length ? (
                    <ul className="mt-1.5 list-disc pl-5 text-sm">
                      {f.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-faint">O workflow não informou motivos.</p>
                  )}
                  <p className="mt-1 text-xs text-faint">
                    Detectada na v{versionNumber(f.detectedInVersionId) ?? "?"}
                    {f.originalStatus ? <> · status original <code className="rounded bg-subtle px-1">{f.originalStatus}</code></> : null}
                    {f.runId ? ` · execução ${runOf(f.runId)?.id ?? f.runId}` : ""}
                  </p>
                  {f.status === "resolvida" ? (
                    <p className="mt-1 text-xs text-muted">
                      Resolvida por {f.resolvedBy} em {formatDateTime(f.resolvedAt)}
                      {versionNumber(f.resolvedInVersionId) ? ` na v${versionNumber(f.resolvedInVersionId)}` : ""} — “{f.resolutionNote}”
                    </p>
                  ) : (
                    <button type="button" className="btn-ghost btn-sm mt-1 -ml-2" onClick={() => setResolving({ kind: "flag", item: f })}>
                      Registrar resolução
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={resolving !== null}
        onClose={() => { setResolving(null); setNote(""); }}
        title={resolving?.kind === "flag" ? "Registrar resolução da pendência" : "Marcar como resolvido"}
        description={
          resolving?.kind === "comment" && resolving.item.type === "ajuste"
            ? `Confirme que o ajuste foi atendido na v${current?.number}. O pedido foi feito na v${resolving.item.target.kind === "artigo" ? resolving.item.target.versionNumber : "?"}.`
            : resolving?.kind === "flag"
              ? `A resolução fica registrada como decisão humana na v${current?.number}.`
              : undefined
        }
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => { setResolving(null); setNote(""); }}>Cancelar</button>
            <button type="button" className="btn-primary" disabled={noteRequired && !note.trim()} onClick={() => void resolve()}>Confirmar</button>
          </>
        }
      >
        <label htmlFor="resolve-note" className="field-label">
          {noteRequired ? "O que foi conferido" : "Nota (opcional)"}
          {noteRequired ? <span className="text-red-700"> *</span> : null}
        </label>
        <textarea id="resolve-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>
    </div>
  );
}
