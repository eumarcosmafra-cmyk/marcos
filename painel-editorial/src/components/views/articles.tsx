"use client";

import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { deriveArticleState, REVIEW_STAGES, type ArticleStage } from "@/domain/rules";
import type { ProjectWorkspace } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { ARTICLE_STAGE, ARTICLE_STAGE_ORDER } from "@/lib/labels";
import { Link } from "@/state/unsaved-guard";
import { DemoTag, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

type StageFilter = ArticleStage | "revisao" | "";

export function ArticlesView({ ws }: { ws: ProjectWorkspace }) {
  const sp = useSearchParams();
  const pathname = usePathname() ?? "";
  const raw = sp?.get("etapa") ?? "";
  const filter: StageFilter = raw === "revisao" || (ARTICLE_STAGE_ORDER as string[]).includes(raw) ? (raw as StageFilter) : "";
  const base = `/p/${ws.project.id}`;

  const rows = useMemo(
    () =>
      ws.articles
        .map((a) => ({ a, s: deriveArticleState(ws, a) }))
        .sort((x, y) => y.s.lastUpdatedAt.localeCompare(x.s.lastUpdatedAt)),
    [ws],
  );
  const visible = rows.filter(({ s }) => (filter === "" ? true : filter === "revisao" ? REVIEW_STAGES.includes(s.stage) : s.stage === filter));

  const set = (v: StageFilter) => window.history.replaceState(null, "", v ? `${pathname}?etapa=${v}` : pathname);
  const chips: { key: StageFilter; label: string }[] = [
    { key: "", label: "Todos" },
    { key: "revisao", label: "Aguardando revisão" },
    ...ARTICLE_STAGE_ORDER.map((k) => ({ key: k as StageFilter, label: ARTICLE_STAGE[k].label })),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={ws.project.name}
        title="Artigos"
        description="A etapa de cada artigo é calculada a partir das decisões registradas na versão atual."
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por etapa">
        {chips.map((c) => {
          const count = c.key === "" ? rows.length : c.key === "revisao" ? rows.filter(({ s }) => REVIEW_STAGES.includes(s.stage)).length : rows.filter(({ s }) => s.stage === c.key).length;
          return (
            <button
              key={c.key || "todos"}
              type="button"
              aria-pressed={filter === c.key}
              onClick={() => set(c.key)}
              className={clsx("chip transition-colors", filter === c.key ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle")}
            >
              {c.label} <span className={clsx("tabular-nums", filter === c.key ? "text-brand-100" : "text-faint")}>{count}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nenhum artigo neste projeto." action={<Link className="btn-secondary" href={`${base}/pautas`}>Ver pautas</Link>}>
          Um artigo é aberto quando uma pauta é aprovada.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Nenhum artigo nesta etapa." action={<button type="button" className="btn-secondary" onClick={() => set("")}>Mostrar todos</button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(({ a, s }) => (
            <li key={a.id}>
              <Link href={`${base}/artigos/${a.id}`} className="card flex flex-col gap-2 px-4 py-3 transition-colors hover:border-brand-300 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{a.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{a.primaryKeyword}</span>
                    <span>· {s.current ? `v${s.current.number}` : "sem versão"}</span>
                    {a.isDemo ? <DemoTag /> : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.openQualityFlags.length ? (
                    <span className="chip border-amber-300 bg-amber-50 text-amber-950">
                      <TriangleAlert className="h-3 w-3" aria-hidden /> {s.openQualityFlags.map((f) => f.kind).join(" + ")}
                    </span>
                  ) : null}
                  {s.openAdjustments.length ? <span className="chip border-amber-300 bg-amber-50 text-amber-950">{s.openAdjustments.length} ajuste(s) aberto(s)</span> : null}
                  <StatusBadge meta={ARTICLE_STAGE[s.stage]} />
                  <span className="text-xs text-faint">{formatDateTime(s.lastUpdatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
