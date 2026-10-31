"use client";

import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileEdit,
  MessageSquare,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
  Undo2,
  GraduationCap,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";
import { buildPendingQueue, computeOverview } from "@/domain/rules";
import type { ActivityType, ProjectWorkspace } from "@/domain/types";
import { formatDateTime, plural } from "@/lib/format";
import { ARTICLE_STAGE, PAUTA_STATUS } from "@/lib/labels";
import type { ArticleStage } from "@/domain/rules";
import type { PautaStatus } from "@/domain/types";
import { Link } from "@/state/unsaved-guard";
import { DemoTag, EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/ui";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  comentario: MessageSquare,
  edicao: FileEdit,
  devolucao: Undo2,
  aprovacao: CheckCircle2,
  ajuste: RotateCcw,
  revisao_especialista: GraduationCap,
  criacao: PlusCircle,
  resolucao: Wrench,
};

function Counter({ href, label, value, hint, icon: Icon }: { href: string; label: string; value: number; hint: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="card group flex flex-col gap-1 px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="h-4 w-4 text-brand-700" aria-hidden />
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-ink">{value}</span>
      <span className="flex items-center gap-1 text-xs text-faint group-hover:text-brand-800">
        {hint}
        <ArrowRight className="h-3 w-3" aria-hidden />
      </span>
    </Link>
  );
}

export function OverviewView({ ws }: { ws: ProjectWorkspace }) {
  const base = `/p/${ws.project.id}`;
  const counters = useMemo(() => computeOverview(ws), [ws]);
  const queue = useMemo(() => buildPendingQueue(ws), [ws]);
  const activity = useMemo(() => [...ws.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12), [ws]);

  const hrefFor = (kind: "pauta" | "artigo", id: string) => (kind === "pauta" ? `${base}/pautas/${id}` : `${base}/artigos/${id}`);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            {ws.project.name} {ws.project.isDemo ? <DemoTag /> : null}
          </span>
        }
        title="Visão geral"
        description="O que exige atenção agora. Os números são calculados a partir das pautas, artigos e decisões deste projeto."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Counter href={`${base}/pautas?status=sugerida,em_revisao`} label="Pautas aguardando decisão" value={counters.pautasAwaitingDecision} hint="Ver pautas" icon={ClipboardCheck} />
        <Counter href={`${base}/artigos?etapa=revisao`} label="Artigos aguardando revisão" value={counters.articlesAwaitingReview} hint="Ver artigos" icon={FileEdit} />
        <Counter href={`${base}/artigos?etapa=ajustes_solicitados`} label="Pedidos de ajuste abertos" value={counters.openAdjustmentRequests} hint={plural(counters.articlesWithAdjustments, "artigo devolvido", "artigos devolvidos")} icon={RotateCcw} />
        <Counter href={`${base}/artigos?etapa=aprovado_publicacao`} label="Aprovados para publicação" value={counters.articlesApproved} hint="Ainda não publicados" icon={ShieldCheck} />
      </div>
      {counters.openQualityFlags > 0 ? (
        <p className="mt-2 text-xs text-muted">
          {plural(counters.openQualityFlags, "pendência de qualidade aberta", "pendências de qualidade abertas")} (legibilidade/fontes) — bloqueiam a aprovação final.
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard title="Fila de pendências" description="Itens que dependem de uma decisão ou ação humana, do mais recente para o mais antigo.">
          {queue.length === 0 ? (
            <EmptyState title="Nenhuma pendência neste projeto.">
              Quando uma pauta for sugerida ou um artigo chegar para revisão, ele aparece aqui.
            </EmptyState>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-head">
                      <th scope="col" className="px-2 py-2">Título</th>
                      <th scope="col" className="px-2 py-2">Palavra-chave</th>
                      <th scope="col" className="px-2 py-2">Etapa</th>
                      <th scope="col" className="px-2 py-2">Atualização</th>
                      <th scope="col" className="px-2 py-2"><span className="sr-only">Ação</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((q) => (
                      <tr key={q.key} className="border-b border-line last:border-0 align-top">
                        <td className="px-2 py-2.5">
                          <Link href={hrefFor(q.kind, q.id)} className="font-medium text-ink hover:text-brand-800 hover:underline">
                            {q.title}
                          </Link>
                          <div className="mt-0.5 text-xs text-muted">{q.nextAction}</div>
                        </td>
                        <td className="px-2 py-2.5 text-muted">{q.keyword}</td>
                        <td className="px-2 py-2.5">
                          <StatusBadge size="sm" meta={q.kind === "pauta" ? PAUTA_STATUS[q.stageKey as PautaStatus] : ARTICLE_STAGE[q.stageKey as ArticleStage]} />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted">{formatDateTime(q.updatedAt)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <Link href={hrefFor(q.kind, q.id)} className="btn-secondary btn-sm" aria-label={`Abrir ${q.title}`}>
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-2 md:hidden">
                {queue.map((q) => (
                  <li key={q.key}>
                    <Link href={hrefFor(q.kind, q.id)} className="block rounded-md border border-line px-3 py-2 hover:bg-subtle">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge size="sm" meta={q.kind === "pauta" ? PAUTA_STATUS[q.stageKey as PautaStatus] : ARTICLE_STAGE[q.stageKey as ArticleStage]} />
                        <span className="text-xs text-faint">{formatDateTime(q.updatedAt)}</span>
                      </div>
                      <p className="mt-1 font-medium text-ink">{q.title}</p>
                      <p className="text-xs text-muted">{q.keyword} · {q.nextAction}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </SectionCard>

        <SectionCard title="Atividade recente" description="Comentários, edições, devoluções e aprovações registrados.">
          {activity.length === 0 ? (
            <EmptyState title="Sem atividade registrada ainda." />
          ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.type];
                const href = a.link.kind === "pauta" ? `${base}/pautas/${a.link.pautaId}` : `${base}/artigos/${a.link.articleId}${a.link.tab ? `?aba=${a.link.tab}` : ""}`;
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <Link href={href} className="text-ink hover:text-brand-800 hover:underline">
                        {a.summary}
                      </Link>
                      <p className="text-xs text-faint">
                        {a.actorName} · {formatDateTime(a.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>
      </div>

      <p className="mt-6 text-xs text-faint">
        Tráfego, posições no Google, receita e custos não são exibidos: nenhuma fonte de dados está conectada a este projeto.
      </p>
    </div>
  );
}
