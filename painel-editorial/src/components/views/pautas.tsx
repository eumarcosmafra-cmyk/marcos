"use client";

import clsx from "clsx";
import { Columns3, Plus, Rows3, Search, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Pauta, PautaStatus, Priority, ProjectWorkspace, SearchIntent } from "@/domain/types";
import { formatCalendarDate, formatDateTime } from "@/lib/format";
import { INTENT_LABEL, PAUTA_STATUS, PAUTA_STATUS_ORDER, PRIORITY_LABEL } from "@/lib/labels";
import { useEditorial } from "@/state/editorial";
import { Link, useGuardedRouter } from "@/state/unsaved-guard";
import { DemoTag, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

interface Filters {
  q: string;
  status: PautaStatus[];
  cluster: string;
  intent: SearchIntent | "";
  priority: Priority | "";
}

function readFilters(sp: URLSearchParams): Filters {
  const status = (sp.get("status") ?? "")
    .split(",")
    .filter((s): s is PautaStatus => (PAUTA_STATUS_ORDER as string[]).includes(s));
  const intent = sp.get("intencao") ?? "";
  const priority = sp.get("prioridade") ?? "";
  return {
    q: sp.get("q") ?? "",
    status,
    cluster: sp.get("cluster") ?? "",
    intent: intent in INTENT_LABEL ? (intent as SearchIntent) : "",
    priority: priority in PRIORITY_LABEL ? (priority as Priority) : "",
  };
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function applyPautaFilters(pautas: Pauta[], f: Filters): Pauta[] {
  const q = normalize(f.q.trim());
  return pautas.filter((p) => {
    if (q && !normalize(`${p.title} ${p.primaryKeyword} ${p.secondaryKeywords.join(" ")}`).includes(q)) return false;
    if (f.status.length && !f.status.includes(p.status)) return false;
    if (f.cluster && p.cluster !== f.cluster) return false;
    if (f.intent && p.intent !== f.intent) return false;
    if (f.priority && p.priority !== f.priority) return false;
    return true;
  });
}

const PRIORITY_DOT: Record<Priority, string> = { alta: "bg-red-600", media: "bg-amber-500", baixa: "bg-slate-400" };

function PriorityLabel({ p }: { p: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={clsx("h-2 w-2 rounded-full", PRIORITY_DOT[p])} aria-hidden />
      {PRIORITY_LABEL[p]}
    </span>
  );
}

export function PautasView({ ws }: { ws: ProjectWorkspace }) {
  const sp = useSearchParams();
  const pathname = usePathname() ?? "";
  const guarded = useGuardedRouter();
  const { projects } = useEditorial();
  const urlFilters = useMemo(() => readFilters(new URLSearchParams(sp?.toString() ?? "")), [sp]);
  // Busca com estado local (resposta imediata) e sincronização da URL com atraso.
  const [q, setQ] = useState(urlFilters.q);
  const filters = useMemo(() => ({ ...urlFilters, q }), [urlFilters, q]);
  const view = sp?.get("visao") === "quadro" ? "quadro" : "lista";
  const base = `/p/${ws.project.id}`;

  const clusters = useMemo(() => Array.from(new Set(ws.pautas.map((p) => p.cluster).filter(Boolean))).sort(), [ws.pautas]);
  const visible = useMemo(
    () => applyPautaFilters(ws.pautas, filters).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [ws.pautas, filters],
  );
  const anyFilter = Boolean(filters.q || filters.status.length || filters.cluster || filters.intent || filters.priority);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (value) next.set(key, value);
    else next.delete(key);
    window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
  };

  useEffect(() => {
    if (q === urlFilters.q) return;
    const t = window.setTimeout(() => setParam("q", q), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleStatus = (s: PautaStatus) => {
    const set = new Set(filters.status);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    setParam("status", PAUTA_STATUS_ORDER.filter((x) => set.has(x)).join(","));
  };

  const clearAll = () => {
    setQ("");
    const next = new URLSearchParams();
    if (view === "quadro") next.set("visao", "quadro");
    window.history.replaceState(null, "", `${pathname}?${next.toString()}`);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={ws.project.name}
        title="Pautas e planejamento"
        description="Lista e quadro mostram as mesmas pautas com os mesmos filtros. Aprovar uma pauta não aprova o futuro artigo."
        actions={
          <Link href={`${base}/pautas/nova`} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Nova pauta
          </Link>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 px-3 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="relative md:min-w-[16rem] md:flex-1">
            <label htmlFor="pauta-busca" className="sr-only">Buscar por título ou palavra-chave</label>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden />
            <input
              id="pauta-busca"
              type="search"
              className="input pl-8"
              placeholder="Buscar por título ou palavra-chave"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:w-[38rem] md:flex-none">
            <div>
              <label htmlFor="f-projeto" className="mb-0.5 block text-xs text-muted">Projeto</label>
              <select
                id="f-projeto"
                className="input py-1.5"
                value={ws.project.id}
                onChange={(e) => guarded.push(`/p/${e.target.value}/pautas`)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.shortName}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-cluster" className="mb-0.5 block text-xs text-muted">Cluster</label>
              <select id="f-cluster" className="input py-1.5" value={filters.cluster} onChange={(e) => setParam("cluster", e.target.value)}>
                <option value="">Todos</option>
                {clusters.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-intencao" className="mb-0.5 block text-xs text-muted">Intenção</label>
              <select id="f-intencao" className="input py-1.5" value={filters.intent} onChange={(e) => setParam("intencao", e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(INTENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f-prioridade" className="mb-0.5 block text-xs text-muted">Prioridade</label>
              <select id="f-prioridade" className="input py-1.5" value={filters.priority} onChange={(e) => setParam("prioridade", e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">Status</legend>
            <span className="mr-1 text-xs text-muted" aria-hidden>Status:</span>
            {PAUTA_STATUS_ORDER.map((s) => {
              const on = filters.status.includes(s);
              const count = ws.pautas.filter((p) => p.status === s).length;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleStatus(s)}
                  className={clsx(
                    "chip transition-colors",
                    on ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle",
                  )}
                >
                  {PAUTA_STATUS[s].label.replace("Pauta ", "")}
                  <span className={clsx("tabular-nums", on ? "text-brand-100" : "text-faint")}>{count}</span>
                </button>
              );
            })}
            {anyFilter ? (
              <button type="button" className="btn-ghost btn-sm" onClick={clearAll}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Limpar filtros
              </button>
            ) : null}
          </fieldset>
          <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              aria-pressed={view === "lista"}
              onClick={() => setParam("visao", "")}
              className={clsx("inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium", view === "lista" ? "bg-brand-700 text-white" : "text-muted hover:bg-subtle")}
            >
              <Rows3 className="h-3.5 w-3.5" aria-hidden /> Lista
            </button>
            <button
              type="button"
              aria-pressed={view === "quadro"}
              onClick={() => setParam("visao", "quadro")}
              className={clsx("inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium", view === "quadro" ? "bg-brand-700 text-white" : "text-muted hover:bg-subtle")}
            >
              <Columns3 className="h-3.5 w-3.5" aria-hidden /> Quadro
            </button>
          </div>
        </div>
        <p className="text-xs text-faint" aria-live="polite">
          {visible.length} de {ws.pautas.length} pauta(s)
        </p>
      </div>

      {ws.pautas.length === 0 ? (
        <EmptyState title="Este projeto ainda não tem pautas." action={<Link href={`${base}/pautas/nova`} className="btn-primary">Criar a primeira pauta</Link>}>
          As sugestões do agente Planejador aparecerão aqui quando a integração com o n8n for conectada. Por enquanto, crie pautas manualmente.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="Nenhuma pauta corresponde aos filtros." action={<button type="button" className="btn-secondary" onClick={clearAll}>Limpar filtros</button>} />
      ) : view === "lista" ? (
        <PautaTable pautas={visible} base={base} />
      ) : (
        <PautaBoard pautas={visible} base={base} statuses={filters.status.length ? filters.status : PAUTA_STATUS_ORDER} />
      )}
    </div>
  );
}

function PautaTable({ pautas, base }: { pautas: Pauta[]; base: string }) {
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th scope="col" className="px-3 py-2">Pauta</th>
              <th scope="col" className="px-3 py-2">Cluster</th>
              <th scope="col" className="px-3 py-2">Intenção</th>
              <th scope="col" className="px-3 py-2">Prioridade</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Data planejada</th>
              <th scope="col" className="px-3 py-2">Atualização</th>
            </tr>
          </thead>
          <tbody>
            {pautas.map((p) => (
              <tr key={p.id} className="border-b border-line align-top last:border-0 hover:bg-subtle/60">
                <td className="px-3 py-2.5">
                  <Link href={`${base}/pautas/${p.id}`} className="font-medium text-ink hover:text-brand-800 hover:underline">
                    {p.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{p.primaryKeyword}</span>
                    {p.isDemo ? <DemoTag /> : null}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted">{p.cluster || "—"}</td>
                <td className="px-3 py-2.5 text-muted">{INTENT_LABEL[p.intent]}</td>
                <td className="px-3 py-2.5"><PriorityLabel p={p.priority} /></td>
                <td className="px-3 py-2.5"><StatusBadge size="sm" meta={PAUTA_STATUS[p.status]} /></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatCalendarDate(p.plannedDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {pautas.map((p) => (
          <li key={p.id}>
            <PautaCard p={p} base={base} />
          </li>
        ))}
      </ul>
    </>
  );
}

function PautaCard({ p, base, hideStatus }: { p: Pauta; base: string; hideStatus?: boolean }) {
  return (
    <Link href={`${base}/pautas/${p.id}`} className="card block px-3 py-2.5 transition-colors hover:border-brand-300">
      <div className="flex flex-wrap items-center gap-1.5">
        {hideStatus ? null : <StatusBadge size="sm" meta={PAUTA_STATUS[p.status]} />}
        <PriorityLabel p={p.priority} />
        {p.isDemo ? <DemoTag /> : null}
      </div>
      <p className="mt-1.5 text-sm font-medium leading-snug text-ink">{p.title}</p>
      <p className="mt-0.5 text-xs text-muted">{p.primaryKeyword}</p>
      <p className="mt-1.5 text-xs text-faint">
        {p.cluster} · {INTENT_LABEL[p.intent]}
        {p.plannedDate ? ` · planejada ${formatCalendarDate(p.plannedDate)}` : ""}
      </p>
    </Link>
  );
}

function PautaBoard({ pautas, base, statuses }: { pautas: Pauta[]; base: string; statuses: PautaStatus[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {statuses.map((s) => {
        const col = pautas.filter((p) => p.status === s);
        const meta = PAUTA_STATUS[s];
        return (
          <section key={s} aria-labelledby={`col-${s}`} className="flex min-w-0 flex-col rounded-lg border border-line bg-subtle/70">
            <h2 id={`col-${s}`} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-sm font-semibold">
              <StatusBadge meta={meta} />
              <span className="text-xs font-normal tabular-nums text-muted">{col.length}</span>
            </h2>
            <ul className="flex flex-col gap-2 p-2">
              {col.length === 0 ? (
                <li className="px-1 py-3 text-xs text-faint">Nenhuma pauta nesta etapa.</li>
              ) : (
                col.map((p) => (
                  <li key={p.id}>
                    <PautaCard p={p} base={base} hideStatus />
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
