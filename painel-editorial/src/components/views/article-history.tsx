"use client";

import { ArrowLeftRight, GitCommitVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { getArticleDecisions, type ArticleState } from "@/domain/rules";
import type { Article, ArticleDecision, ProjectWorkspace } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { ADJUSTMENT_STAGE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { DemoTag, ToneChip } from "@/components/ui";
import { VersionDiff } from "@/components/version-diff";

export const DECISION_META: Record<ArticleDecision["kind"], { label: string; tone: "success" | "warning" | "brand" | "info" }> = {
  ajustes_solicitados: { label: "Ajustes solicitados", tone: "warning" },
  aprovacao_editorial: { label: "Aprovação editorial", tone: "info" },
  revisao_especialista: { label: "Revisão do especialista", tone: "brand" },
  aprovacao_final: { label: "Aprovado para publicação", tone: "success" },
};

export function DecisionLine({ d, historical }: { d: ArticleDecision; historical?: boolean }) {
  const meta = DECISION_META[d.kind];
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ToneChip tone={meta.tone}>{meta.label}</ToneChip>
        <span className="text-xs text-muted">v{d.target.versionNumber}</span>
        {historical ? <span className="text-xs font-medium text-amber-800">somente histórico</span> : null}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {d.reviewerName} ({ROLE_LABEL[d.reviewerRole]}) · {formatDateTime(d.createdAt)}
        {d.adjustmentStage ? ` · etapa: ${ADJUSTMENT_STAGE_LABEL[d.adjustmentStage]}` : ""}
        {d.specialistOutcome ? ` · ${d.specialistOutcome === "aprovado" ? "aprovado" : "aprovado com observações"}` : ""}
      </p>
      {d.comment ? <p className="mt-0.5 text-ink">“{d.comment}”</p> : null}
    </div>
  );
}

export function ArticleHistory({ ws, article, state }: { ws: ProjectWorkspace; article: Article; state: ArticleState }) {
  const versions = useMemo(() => [...article.versions].sort((a, b) => b.number - a.number), [article.versions]);
  const decisions = useMemo(() => getArticleDecisions(ws, article.id), [ws, article.id]);
  const currentId = article.currentVersionId;
  const [from, setFrom] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [to, setTo] = useState(versions[0]?.id ?? "");
  const vFrom = article.versions.find((v) => v.id === from);
  const vTo = article.versions.find((v) => v.id === to);

  const isHistorical = (d: ArticleDecision) =>
    d.target.versionId !== currentId || (Boolean(state.adjustmentOnCurrent) && d.kind !== "ajustes_solicitados");

  return (
    <div className="flex flex-col gap-5">
      <section className="card px-4 py-3" aria-labelledby="cmp-title">
        <h3 id="cmp-title" className="flex items-center gap-1.5 text-sm font-semibold">
          <ArrowLeftRight className="h-4 w-4" aria-hidden /> Comparar versões
        </h3>
        {versions.length < 2 ? (
          <p className="mt-2 text-sm text-faint">É preciso ao menos duas versões para comparar. Salve uma nova versão na aba Artigo.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="cmp-from" className="mb-0.5 block text-xs text-muted">De</label>
                <select id="cmp-from" className="input py-1.5" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.number} · {formatDateTime(v.createdAt)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cmp-to" className="mb-0.5 block text-xs text-muted">Para</label>
                <select id="cmp-to" className="input py-1.5" value={to} onChange={(e) => setTo(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.number} · {formatDateTime(v.createdAt)}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setFrom(to); setTo(from); }}>
                Inverter
              </button>
            </div>
            <div className="mt-3">
              {vFrom && vTo ? <VersionDiff before={vFrom.markdown} after={vTo.markdown} labelBefore={`v${vFrom.number}`} labelAfter={`v${vTo.number}`} /> : null}
            </div>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="ver-title">
        <h3 id="ver-title" className="border-b border-line px-4 py-3 text-sm font-semibold">Versões e decisões</h3>
        <ol className="flex flex-col">
          {versions.map((v) => {
            const ds = decisions.filter((d) => d.target.versionId === v.id);
            const isCurrent = v.id === currentId;
            const base = v.basedOnVersionId ? article.versions.find((x) => x.id === v.basedOnVersionId) : undefined;
            return (
              <li key={v.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
                <GitCommitVertical className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">v{v.number}</span>
                    {isCurrent ? <span className="chip border-brand-300 bg-brand-50 text-brand-900">Versão atual</span> : null}
                    {v.origin.kind === "demonstracao" ? <DemoTag /> : null}
                    <span className="text-xs text-muted">{formatDateTime(v.createdAt)} · {v.createdBy}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {v.origin.label}
                    {base ? ` · editada a partir da v${base.number}` : ""}
                    {v.runId ? ` · execução ${v.runId}` : ""}
                  </p>
                  {v.changeNote ? <p className="mt-0.5 text-sm">{v.changeNote}</p> : null}
                  {ds.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-3">
                      {ds.map((d) => (
                        <li key={d.id}>
                          <DecisionLine d={d} historical={isHistorical(d)} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-faint">Nenhuma decisão registrada nesta versão.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
