"use client";

import clsx from "clsx";
import { FlaskConical, Loader2, RefreshCw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Ambiente, TrabalhoResumoDTO } from "@/lib/fila-types";
import { formatDateTime } from "@/lib/format";
import { Link } from "@/state/unsaved-guard";
import { api } from "@/components/real/api";
import { estadoMeta } from "@/components/real/labels";
import { LoadError } from "@/components/real/load-state";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { AmbienteBadge } from "@/components/real/badges";

interface ListaResposta {
  ambiente: Ambiente;
  trabalhos: TrabalhoResumoDTO[];
  titulos_disponiveis: boolean;
  consultado_em: string;
}

function aprovacaoTexto(t: TrabalhoResumoDTO): string {
  if (t.controle.aprovacao_editorial) return "Aprovada";
  if (t.estado === "aprovacao_simulada") return "Simulada (teste)";
  if (t.decisao_atual?.decisao === "devolver") return "Devolvida";
  return "Pendente";
}

function FilaLista() {
  const sp = useSearchParams();
  const pathname = usePathname() ?? "/fila";
  const ambiente: Ambiente = sp?.get("ambiente") === "teste" ? "teste" : "producao";
  const [dados, setDados] = useState<ListaResposta | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarregando(true);
    setErro(null);
    api<ListaResposta>(`/api/fila?ambiente=${ambiente}`, { signal: ctrl.signal })
      .then((r) => setDados(r))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[fila] Erro ao carregar:", e);
        setDados(null);
        setErro(e);
      })
      .finally(() => setCarregando(false));
    return () => ctrl.abort();
  }, [ambiente, tentativa]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = dados?.trabalhos ?? [];
    if (!q) return lista;
    return lista.filter((t) => `${t.pauta_id} ${t.keyword} ${t.titulo_artigo ?? ""} ${t.titulo_pauta ?? ""}`.toLowerCase().includes(q));
  }, [dados, busca]);

  const trocarAmbiente = (a: Ambiente) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    if (a === "producao") next.delete("ambiente");
    else next.set("ambiente", a);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Alto Vale Top Team · fila editorial V2 (n8n)"
        title="Pautas e trabalhos"
        description="Dados lidos da fila real do n8n. Aprovação editorial é diferente de revisão do professor e de autorização de publicação."
        actions={
          <button type="button" className="btn-secondary" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Atualizar
          </button>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Ambiente">
          {(["producao", "teste"] as Ambiente[]).map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={ambiente === a}
              onClick={() => trocarAmbiente(a)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium",
                ambiente === a ? (a === "producao" ? "bg-emerald-700 text-white" : "bg-amber-600 text-white") : "text-muted hover:bg-subtle",
              )}
            >
              {a === "producao" ? <ShieldCheck className="h-4 w-4" aria-hidden /> : <FlaskConical className="h-4 w-4" aria-hidden />}
              {a === "producao" ? "Produção" : "Teste"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <label htmlFor="busca" className="sr-only">Buscar por pauta, palavra-chave ou título</label>
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden />
          <input id="busca" type="search" className="input pl-8" placeholder="Buscar por pauta, palavra-chave ou título" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {dados ? <p className="text-xs text-faint" aria-live="polite">Consultado em {formatDateTime(dados.consultado_em)}</p> : null}
      </div>

      {ambiente === "teste" ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <FlaskConical className="h-4 w-4" aria-hidden /> Ambiente de teste: decisões ficam registradas como simulação e não valem como aprovação.
        </p>
      ) : null}

      {carregando && !dados ? (
        <p className="flex items-center gap-2 py-12 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consultando a fila no n8n…
        </p>
      ) : erro ? (
        <LoadError error={erro} onRetry={carregar} titulo="Não foi possível consultar a fila" />
      ) : dados && dados.trabalhos.length === 0 ? (
        <EmptyState title={`Nenhum trabalho no ambiente ${ambiente === "producao" ? "de produção" : "de teste"}.`}>
          A fila do n8n respondeu sem registros para este cliente e ambiente.
        </EmptyState>
      ) : dados ? (
        <>
          {!dados.titulos_disponiveis ? (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-800">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Títulos indisponíveis nesta consulta; exibindo pauta e palavra-chave.
            </p>
          ) : null}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th scope="col" className="px-3 py-2">Pauta / artigo</th>
                  <th scope="col" className="px-3 py-2">Estado</th>
                  <th scope="col" className="px-3 py-2">Versão</th>
                  <th scope="col" className="px-3 py-2">Pendências</th>
                  <th scope="col" className="px-3 py-2">Aprovação editorial</th>
                  <th scope="col" className="px-3 py-2">Atualização</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((t) => (
                  <tr key={t.job_key} className="border-b border-line align-top last:border-0 hover:bg-subtle/60">
                    <td className="px-3 py-2.5">
                      <Link href={`/fila/${t.job_key}?ambiente=${ambiente}`} className="font-medium text-ink hover:text-brand-800 hover:underline">
                        {t.titulo_artigo ?? t.titulo_pauta ?? t.keyword}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span className="font-mono">{t.pauta_id}</span>
                        <span>· {t.keyword}</span>
                        <span>· <span className="font-mono">{t.job_key.slice(0, 8)}</span></span>
                        {t.modo_execucao === "simulado" ? <span className="chip border-amber-300 bg-amber-50 text-amber-950">simulado</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge size="sm" meta={estadoMeta(t.estado)} />
                      {t.em_execucao ? <span className="mt-1 block text-xs text-muted">etapa em execução</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      v{t.versao_artigo} · rev. {t.revisao}
                    </td>
                    <td className="px-3 py-2.5">{t.pendencias_qtd ? <span className="chip border-amber-300 bg-amber-50 text-amber-950">{t.pendencias_qtd}</span> : <span className="text-faint">0</span>}</td>
                    <td className="px-3 py-2.5 text-muted">{aprovacaoTexto(t)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{formatDateTime(t.atualizado_em ?? undefined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-col gap-2 md:hidden">
            {visiveis.map((t) => (
              <li key={t.job_key}>
                <Link href={`/fila/${t.job_key}?ambiente=${ambiente}`} className="card block px-3 py-2.5 hover:border-brand-300">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge size="sm" meta={estadoMeta(t.estado)} />
                    <AmbienteBadge ambiente={t.ambiente} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{t.titulo_artigo ?? t.titulo_pauta ?? t.keyword}</p>
                  <p className="text-xs text-muted">
                    {t.pauta_id} · {t.keyword} · v{t.versao_artigo} · rev. {t.revisao} · {t.pendencias_qtd} pendência(s)
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {visiveis.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum trabalho corresponde à busca.</p> : null}
        </>
      ) : null}
    </div>
  );
}

export default function FilaPage() {
  return (
    <Suspense fallback={null}>
      <FilaLista />
    </Suspense>
  );
}
