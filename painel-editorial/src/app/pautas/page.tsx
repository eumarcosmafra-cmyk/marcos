"use client";

import clsx from "clsx";
import { ChevronRight, ClipboardList, Loader2, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ListaPautasDTO, PautaDTO } from "@/lib/pautas-types";
import { formatDateTime } from "@/lib/format";
import { Link } from "@/state/unsaved-guard";
import { api } from "@/components/real/api";
import { estadoMeta } from "@/components/real/labels";
import { LoadError } from "@/components/real/load-state";
import { ESTADO_FONTES, filtroDaPauta, type FiltroPauta } from "@/components/real/pautas-labels";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

type Resposta = ListaPautasDTO & { consultado_em: string };

const FILTROS: { key: FiltroPauta; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "sem_fontes", label: "Sem fontes" },
  { key: "propostas", label: "Fontes para aprovar" },
  { key: "prontas", label: "Prontas para produzir" },
  { key: "na_fila", label: "Na fila" },
];

function Trabalho({ p }: { p: PautaDTO }) {
  if (!p.trabalhos.length) return <span className="text-faint">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {p.trabalhos.map((t) => (
        <Link key={t.job_key} href={`/fila/${t.job_key}${t.ambiente === "teste" ? "?ambiente=teste" : ""}`} className="inline-flex items-center gap-1.5 hover:underline">
          <StatusBadge meta={estadoMeta(t.estado)} size="sm" />
          <span className="text-xs text-muted">{t.ambiente === "teste" ? "teste" : "produção"} · v{t.versao_artigo}</span>
        </Link>
      ))}
    </div>
  );
}

export default function PautasPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroPauta>("todas");

  const carregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarregando(true);
    setErro(null);
    api<Resposta>("/api/pautas", { signal: ctrl.signal })
      .then(setDados)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[pautas] Erro ao carregar:", e);
        setErro(e);
      })
      .finally(() => setCarregando(false));
    return () => ctrl.abort();
  }, [tentativa]);

  const planos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.planos ?? []).map((pl) => ({
      ...pl,
      visiveis: pl.pautas.filter(
        (p) => (filtro === "todas" || filtroDaPauta(p) === filtro) && (!q || `${p.id} ${p.keyword} ${p.titulo} ${p.tema ?? ""}`.toLowerCase().includes(q)),
      ),
    }));
  }, [dados, busca, filtro]);

  const contagem = useMemo(() => {
    const c: Record<FiltroPauta, number> = { todas: 0, sem_fontes: 0, propostas: 0, prontas: 0, na_fila: 0 };
    for (const pl of dados?.planos ?? [])
      for (const p of pl.pautas) {
        c.todas += 1;
        c[filtroDaPauta(p)] += 1;
      }
    return c;
  }, [dados]);

  return (
    <div>
      <PageHeader
        eyebrow="Alto Vale Top Team · planos do Planejador (n8n)"
        title="Pautas"
        description="Escolha uma pauta, aprove as 3 fontes e mande produzir. O artigo segue para a fila editorial, onde você revisa e aprova."
        actions={
          <button type="button" className="btn-secondary" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Atualizar
          </button>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 px-3 py-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar pautas">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filtro === f.key}
              onClick={() => setFiltro(f.key)}
              className={clsx("rounded-md px-2.5 py-1.5 text-sm", filtro === f.key ? "bg-brand-700 font-medium text-white" : "text-muted hover:bg-subtle")}
            >
              {f.label} <span className={filtro === f.key ? "text-brand-100" : "text-faint"}>{contagem[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <label htmlFor="busca-pauta" className="sr-only">Buscar pauta</label>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden />
          <input id="busca-pauta" type="search" className="input pl-8" placeholder="Buscar por pauta, palavra-chave ou tema" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {dados ? <p className="text-xs text-faint">Consultado em {formatDateTime(dados.consultado_em)}</p> : null}
      </div>

      {dados && !dados.fila_consultada ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-800">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> A fila não respondeu: a situação dos artigos pode estar incompleta.
        </p>
      ) : null}
      {dados?.falhas.length ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-amber-800">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {dados.falhas.length} registro(s) não passaram na conferência de integridade e foram ocultados.
        </p>
      ) : null}

      {carregando && !dados ? (
        <p className="flex items-center gap-2 py-12 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo os planos no n8n…
        </p>
      ) : erro && !dados ? (
        <LoadError error={erro} onRetry={carregar} titulo="Não foi possível ler as pautas" />
      ) : dados && dados.planos.length === 0 ? (
        <EmptyState title="Nenhum plano gravado para este cliente." icon={ClipboardList}>
          Os planos são gravados pelo Planejador no n8n. A geração de plano pelo painel vem na próxima entrega.
        </EmptyState>
      ) : (
        planos.map((pl) => (
          <section key={pl.plano_id} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-ink">
              Plano de {formatDateTime(pl.criado_em ?? undefined)} <span className="font-normal text-faint">· {pl.pautas.length} pautas · {pl.plano_id.slice(0, 11)}</span>
            </h2>
            {pl.visiveis.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma pauta deste plano no filtro atual.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {pl.visiveis.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pautas/${pl.plano_id}/${p.id}`} className="grid gap-2 px-4 py-3 hover:bg-subtle/60 md:grid-cols-[1fr_auto_auto_auto] md:items-center md:gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-faint">
                          <span className="font-mono font-medium text-muted">{p.id}</span>
                          {p.tema ? ` · ${p.tema}` : ""}
                          {p.intencao ? ` · ${p.intencao}` : ""}
                          {p.prioridade ? ` · prioridade ${p.prioridade}` : ""}
                          {p.acao && p.acao !== "criar" ? ` · ${p.acao}` : ""}
                        </p>
                        <p className="font-medium text-ink">{p.titulo}</p>
                        <p className="text-sm text-muted">{p.keyword}</p>
                      </div>
                      <StatusBadge meta={ESTADO_FONTES[p.fontes.estado]} />
                      <Trabalho p={p} />
                      <ChevronRight className="hidden h-4 w-4 text-faint md:block" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
