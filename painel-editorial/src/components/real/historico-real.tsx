"use client";

import { ArrowLeftRight, GitCommitVertical, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Ambiente, TrabalhoDTO, VersaoTextoDTO } from "@/lib/fila-types";
import { formatDateTime } from "@/lib/format";
import { VersionDiff } from "@/components/version-diff";
import { api } from "./api";
import { EVENTO_HISTORICO, origemVersao } from "./labels";
import { ActionError } from "./load-state";

export function HistoricoReal({ trabalho, ambiente }: { trabalho: TrabalhoDTO; ambiente: Ambiente }) {
  const versoes = [...trabalho.versoes].sort((a, b) => b.numero - a.numero);
  const [comparando, setComparando] = useState<VersaoTextoDTO | null>(null);
  const [carregando, setCarregando] = useState<number | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  const comparar = async (numero: number) => {
    setCarregando(numero);
    setErro(null);
    try {
      const r = await api<{ versao: VersaoTextoDTO }>(`/api/fila/${trabalho.job_key}/versoes/${numero}?ambiente=${ambiente}`);
      setComparando(r.versao);
    } catch (e) {
      console.error("[historico] Falha ao ler versão:", e);
      setErro(e);
    } finally {
      setCarregando(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="card" aria-labelledby="versoes-titulo">
        <h3 id="versoes-titulo" className="border-b border-line px-4 py-3 text-sm font-semibold">Versões do artigo ({versoes.length})</h3>
        {versoes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-faint">Nenhuma versão registrada.</p>
        ) : (
          <ol>
            {versoes.map((v) => {
              const atual = v.numero === trabalho.versao_artigo;
              const decisoes = trabalho.decisao_atual && trabalho.decisao_atual.versao_artigo === v.numero ? [trabalho.decisao_atual] : [];
              return (
                <li key={v.numero} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
                  <GitCommitVertical className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">v{v.numero}</span>
                      {atual ? <span className="chip border-brand-300 bg-brand-50 text-brand-900">Versão atual</span> : null}
                      {!v.completa ? <span className="chip border-amber-300 bg-amber-50 text-amber-950">incompleta</span> : null}
                      <span className="text-xs text-muted">{formatDateTime(v.em)} · {origemVersao(v.origem)}</span>
                    </div>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-faint">sha256 {v.sha256}</p>
                    {decisoes.map((d) => (
                      <p key={d.em} className="mt-1 text-xs text-muted">
                        Decisão: <strong className="text-ink">{d.decisao === "aprovar" ? "aprovar" : "devolver"}</strong> por {d.nome} em {formatDateTime(d.em)}
                        {d.simulacao ? " (simulação de teste)" : ""}
                      </p>
                    ))}
                    {!atual ? (
                      <button type="button" className="btn-ghost btn-sm mt-1 -ml-2" onClick={() => void comparar(v.numero)} disabled={carregando !== null}>
                        {carregando === v.numero ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />}
                        Comparar com a atual
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <ActionError error={erro} />
      {comparando ? (
        <section className="card px-4 py-3" aria-labelledby="cmp-titulo">
          <h3 id="cmp-titulo" className="mb-2 text-sm font-semibold">
            Comparação v{comparando.numero} → v{trabalho.versao_artigo}
            {!comparando.sha256_confere ? <span className="ml-2 text-xs font-normal text-red-800">(hash da versão antiga não confere)</span> : null}
          </h3>
          <VersionDiff before={comparando.markdown} after={trabalho.artigo_markdown ?? ""} labelBefore={`v${comparando.numero}`} labelAfter={`v${trabalho.versao_artigo}`} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="hist-titulo">
        <h3 id="hist-titulo" className="border-b border-line px-4 py-3 text-sm font-semibold">Histórico do registro</h3>
        {trabalho.historico.length === 0 ? (
          <p className="px-4 py-3 text-sm text-faint">Sem eventos.</p>
        ) : (
          <ol className="flex flex-col">
            {[...trabalho.historico].reverse().map((h, i) => (
              <li key={i} className="border-b border-line px-4 py-2.5 text-sm last:border-0">
                <p className="font-medium">
                  {EVENTO_HISTORICO[h.evento] ?? h.evento.replace(/_/g, " ")}
                  {h.etapa ? <span className="font-normal text-muted"> · {h.etapa}</span> : null}
                  {h.simulacao ? <span className="ml-1 chip border-amber-300 bg-amber-50 text-amber-950">simulação</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {h.ator ? `${h.ator} · ` : ""}
                  {formatDateTime(h.em ?? undefined)}
                </p>
                {Object.keys(h.detalhes).length ? (
                  <p className="mt-0.5 text-xs text-faint">
                    {Object.entries(h.detalhes)
                      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
