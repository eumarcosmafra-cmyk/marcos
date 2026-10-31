"use client";

import { BookMarked, ExternalLink, Receipt, ShieldAlert } from "lucide-react";
import type { Article, ArticleVersion, LibrarySource, ProjectWorkspace, RetrievedChunk, SourceCategory, WorkflowRun } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { SOURCE_CATEGORY } from "@/lib/labels";
import { KNOWN_STATUSES } from "@/domain/workflow-mapping";
import { DemoTag, Notice } from "@/components/ui";

const CATEGORIES: SourceCategory[] = ["dominio", "metodo", "cliente"];

const ACCENT: Record<SourceCategory, string> = {
  dominio: "border-l-sky-600",
  metodo: "border-l-violet-600",
  cliente: "border-l-emerald-600",
};

function safeUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Execução que originou o texto: a da própria versão ou a da versão de base mais próxima. */
export function resolveRunForVersion(article: Article, version: ArticleVersion, runs: WorkflowRun[]): { run?: WorkflowRun; inheritedFrom?: ArticleVersion } {
  let v: ArticleVersion | undefined = version;
  const seen = new Set<string>();
  while (v && !seen.has(v.id)) {
    seen.add(v.id);
    if (v.runId) {
      const run = runs.find((r) => r.id === v?.runId);
      return { run, inheritedFrom: v.id === version.id ? undefined : v };
    }
    const baseId: string | undefined = v.basedOnVersionId;
    v = baseId ? article.versions.find((x) => x.id === baseId) : undefined;
  }
  return {};
}

function OpenLink({ url, label = "Abrir fonte" }: { url?: string; label?: string }) {
  const safe = safeUrl(url);
  if (!safe) return null;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
      {label} <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function ChunkCard({ chunk, run, versionNumber }: { chunk: RetrievedChunk; run: WorkflowRun; versionNumber: number }) {
  const preview = chunk.text.length > 180 ? `${chunk.text.slice(0, 180)}…` : chunk.text;
  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border-emerald-300 bg-emerald-50 text-emerald-900">
          <Receipt className="h-3 w-3" aria-hidden /> Trecho recebido nesta execução
        </span>
        {chunk.isDemo ? <DemoTag>Trecho demonstrativo</DemoTag> : null}
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink">{chunk.title ?? "Título não informado no recibo"}</p>
      <details className="group mt-1">
        <summary className="cursor-pointer list-none text-sm text-muted [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{preview}</span>
          <span className="ml-1 text-xs font-medium text-brand-700 underline group-open:hidden">Expandir trecho</span>
          <span className="hidden text-xs font-medium text-brand-700 underline group-open:inline">Recolher trecho</span>
        </summary>
        <blockquote className="mt-1.5 whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-sm text-ink">{chunk.text}</blockquote>
      </details>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
        <div><dt className="inline font-medium">Chunk: </dt><dd className="inline font-mono">{chunk.chunkId ?? "não informado"}</dd></div>
        <div><dt className="inline font-medium">Recuperado em: </dt><dd className="inline">{chunk.retrievedAt ? formatDateTime(chunk.retrievedAt) : "não informado"}</dd></div>
        <div><dt className="inline font-medium">Execução: </dt><dd className="inline font-mono">{run.id}</dd></div>
        <div><dt className="inline font-medium">Versão gerada: </dt><dd className="inline">v{versionNumber}</dd></div>
        {typeof chunk.similarity === "number" ? (
          <div><dt className="inline font-medium">Similaridade (do dado original{chunk.isDemo ? ", demonstrativo" : ""}): </dt><dd className="inline tabular-nums">{chunk.similarity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</dd></div>
        ) : null}
        {chunk.url ? <div className="sm:col-span-2 break-all"><dt className="inline font-medium">URL: </dt><dd className="inline">{chunk.url}</dd></div> : null}
      </dl>
      <div className="mt-1.5"><OpenLink url={chunk.url} /></div>
    </li>
  );
}

function LibraryCard({ source, receivedInRun }: { source: LibrarySource; receivedInRun: boolean }) {
  return (
    <li className="rounded-md border border-dashed border-line-strong bg-subtle/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border-line-strong bg-surface text-muted">
          <BookMarked className="h-3 w-3" aria-hidden /> Fonte cadastrada na biblioteca
        </span>
        {receivedInRun ? (
          <span className="chip border-emerald-300 bg-emerald-50 text-emerald-900">Há trecho recebido desta fonte</span>
        ) : (
          <span className="chip border-amber-300 bg-amber-50 text-amber-950">
            <ShieldAlert className="h-3 w-3" aria-hidden /> Uso não comprovado nesta execução
          </span>
        )}
        {source.isDemo ? <DemoTag /> : null}
      </div>
      <p className="mt-1.5 text-sm font-medium">{source.title}</p>
      <p className="text-xs text-muted">{source.description}</p>
      {source.excerpt ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-brand-700 underline">Ver trecho cadastrado</summary>
          <blockquote className="mt-1 whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-sm">{source.excerpt}</blockquote>
        </details>
      ) : null}
      <p className="mt-1.5 text-xs text-faint">
        {source.origin.label}
        {source.origin.ref ? <> · <span className="font-mono">{source.origin.ref}</span></> : null} · cadastrada em {formatDateTime(source.registeredAt)}
      </p>
      <div className="mt-1"><OpenLink url={source.url} /></div>
    </li>
  );
}

export function ArticleSources({ ws, article, version }: { ws: ProjectWorkspace; article: Article; version: ArticleVersion }) {
  const { run, inheritedFrom } = resolveRunForVersion(article, version, ws.runs);
  const runChunks = run ? ws.chunks.filter((c) => c.runId === run.id) : [];
  const originVersion = inheritedFrom ?? version;

  return (
    <div className="flex flex-col gap-5">
      <div className="card px-4 py-3">
        <h3 className="text-sm font-semibold">Execução associada à v{version.number}</h3>
        {run ? (
          <>
            <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <div><dt className="inline text-muted">Execução: </dt><dd className="inline font-mono text-xs">{run.id}</dd></div>
              <div><dt className="inline text-muted">Agente: </dt><dd className="inline capitalize">{run.agent}</dd></div>
              <div><dt className="inline text-muted">Recebida em: </dt><dd className="inline">{formatDateTime(run.receivedAt)}</dd></div>
              <div><dt className="inline text-muted">Recibo de trechos: </dt><dd className="inline font-medium">{run.hasRetrievalReceipt ? "Sim" : "Não"}</dd></div>
              <div className="sm:col-span-2">
                <dt className="inline text-muted">Status original do workflow (registro técnico): </dt>
                <dd className="inline">
                  {run.originalStatuses.length ? run.originalStatuses.map((s) => (
                    <code key={s} className="mr-1 rounded bg-subtle px-1 text-xs" title={s in KNOWN_STATUSES ? KNOWN_STATUSES[s as keyof typeof KNOWN_STATUSES].effect : "Status não mapeado"}>{s}</code>
                  )) : "não informado"}
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              {run.isDemo ? <DemoTag>Execução simulada — nenhum workflow foi chamado</DemoTag> : null}
              <span>{run.origin.label}</span>
            </div>
            {inheritedFrom ? (
              <Notice tone="info" className="mt-3">
                A v{version.number} foi editada por uma pessoa a partir da v{inheritedFrom.number}. Os trechos abaixo foram recebidos na execução que gerou a v{inheritedFrom.number}; nenhuma nova recuperação ocorreu.
              </Notice>
            ) : null}
            {!run.hasRetrievalReceipt ? (
              <Notice tone="warning" icon={ShieldAlert} className="mt-3" title="Uso não comprovado nesta execução">
                A execução não trouxe recibo dos trechos recebidos pelo agente. As fontes da biblioteca não podem ser dadas como consultadas.
              </Notice>
            ) : null}
          </>
        ) : (
          <Notice tone="warning" icon={ShieldAlert} className="mt-2" title="Uso não comprovado nesta execução">
            Esta versão não está ligada a nenhuma execução de agente (texto criado manualmente). Nenhum trecho recuperado pode ser atribuído a ela.
          </Notice>
        )}
        <p className="mt-3 text-xs text-faint">
          Uma fonte cadastrada na biblioteca não prova que o agente a consultou. Só aparece como recebida o trecho que consta no recibo da execução. Nenhuma nota de confiabilidade é calculada.
        </p>
      </div>

      {CATEGORIES.map((cat) => {
        const meta = SOURCE_CATEGORY[cat];
        const chunks = runChunks.filter((c) => c.category === cat);
        const receivedIds = new Set(chunks.map((c) => c.librarySourceId).filter(Boolean));
        const library = ws.library.filter((s) => s.category === cat);
        return (
          <section key={cat} aria-labelledby={`src-${cat}`} className={`card border-l-4 ${ACCENT[cat]}`}>
            <div className="border-b border-line px-4 py-3">
              <h3 id={`src-${cat}`} className="text-sm font-semibold">{meta.label}</h3>
              <p className="text-xs text-muted">{meta.description}</p>
            </div>
            <div className="grid gap-4 px-4 py-3 xl:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recebido pelo agente nesta execução</h4>
                {!run || !run.hasRetrievalReceipt ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">Uso não comprovado nesta execução.</p>
                ) : chunks.length === 0 ? (
                  <p className="text-sm text-faint">Nenhum trecho desta categoria consta no recibo da execução.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {chunks.map((c) => (
                      <ChunkCard key={c.id} chunk={c} run={run} versionNumber={originVersion.number} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cadastrado na biblioteca</h4>
                {library.length === 0 ? (
                  <p className="text-sm text-faint">Nenhuma fonte cadastrada nesta categoria.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {library.map((s) => (
                      <LibraryCard key={s.id} source={s} receivedInRun={Boolean(run?.hasRetrievalReceipt) && receivedIds.has(s.id)} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
