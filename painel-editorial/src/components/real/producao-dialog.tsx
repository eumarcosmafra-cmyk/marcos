"use client";

import { Bot, Coins } from "lucide-react";
import { useState } from "react";
import { CHAMADAS_CORRECAO, CHAMADAS_POR_ETAPA, PROXIMA_ETAPA, type Ambiente, type TrabalhoDTO } from "@/lib/fila-types";
import { formatDateTime } from "@/lib/format";
import { Dialog, Notice } from "@/components/ui";
import { api, ApiError, novoOpUuid } from "./api";
import { ActionError } from "./load-state";

export type TipoProducao = "correcao" | "retomar";

export interface RespostaProducao {
  correcao: { revisao: number; estado: string; resultado_reutilizado: boolean } | null;
  producao_iniciada: boolean;
  erro_producao: { codigo: string; mensagem: string } | null;
}

const NOME: Record<string, string> = { pesquisador: "Pesquisador", redator: "Redator", revisor: "Revisor" };
const ORDEM = ["pesquisador", "redator", "revisor"] as const;

/** Etapas que o produtor executa a partir do estado atual (ele roda no máximo 3 por disparo). */
function etapasPlanejadas(estado: string): string[] {
  const inicio = PROXIMA_ETAPA[estado];
  return inicio ? ORDEM.slice(ORDEM.indexOf(inicio)) : [];
}

export function ProducaoDialog({
  trabalho,
  ambiente,
  tipo,
  onClose,
  onDone,
}: {
  trabalho: TrabalhoDTO;
  ambiente: Ambiente;
  tipo: TipoProducao;
  onClose: () => void;
  onDone: (r: RespostaProducao) => void;
}) {
  const [autorizo, setAutorizo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [uuidIncerto, setUuidIncerto] = useState<string | null>(null);

  const simulado = trabalho.modo_execucao === "simulado";
  const correcao = tipo === "correcao";
  const etapas = correcao ? ["redator", "revisor"] : etapasPlanejadas(trabalho.estado);
  const { reservadas, com_uso_confirmado, limite_do_ciclo } = trabalho.chamadas;
  const somaEtapas = etapas.reduce((n, e) => n + (CHAMADAS_POR_ETAPA[e] ?? 0), 0);
  const restantes = limite_do_ciclo === null ? null : Math.max(0, limite_do_ciclo - reservadas);
  const maxChamadas = correcao ? CHAMADAS_CORRECAO : restantes === null ? somaEtapas : Math.min(somaEtapas, restantes);
  const d = trabalho.decisao_atual;
  const versao = `v${trabalho.versao_artigo}`;

  const fechar = () => {
    if (enviando) return;
    setErro(null);
    onClose();
  };

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    // Mesmo identificador só quando a tentativa anterior teve resultado incerto (a fila devolve o resultado já gravado).
    const uuid = correcao ? (uuidIncerto ?? novoOpUuid()) : null;
    try {
      const r = correcao
        ? await api<RespostaProducao & { ok: true }>(`/api/fila/${trabalho.job_key}/correcao?ambiente=${ambiente}`, {
            method: "POST",
            body: { op_uuid: uuid, revisao_esperada: trabalho.revisao, artigo_sha256: trabalho.artigo_sha256, autorizo_chamadas_pagas: true },
          })
        : await api<RespostaProducao & { ok: true }>(`/api/fila/${trabalho.job_key}/producao?ambiente=${ambiente}`, {
            method: "POST",
            body: { revisao_esperada: trabalho.revisao, autorizo_chamadas_pagas: true },
          });
      setUuidIncerto(null);
      onDone({ correcao: r.correcao, producao_iniciada: r.producao_iniciada, erro_producao: r.erro_producao });
    } catch (e) {
      console.error("[producao] Falha:", e);
      setErro(e);
      setUuidIncerto(correcao && e instanceof ApiError && e.resultadoIncerto ? uuid : null);
    } finally {
      setEnviando(false);
    }
  };

  const textoAutorizacao = simulado
    ? "Confirmo a execução simulada: o produtor usa respostas preservadas e não chama modelos de IA."
    : `Autorizo até ${maxChamadas} chamada(s) paga(s) de API para ${correcao ? `corrigir a ${versao}` : "esta etapa"} (${ambiente === "producao" ? "produção" : "teste"}).`;

  return (
    <Dialog
      open
      onClose={fechar}
      size="lg"
      title={correcao ? `Solicitar correção da ${versao}` : `Retomar produção: ${etapas.map((e) => NOME[e]).join(" → ")}`}
      description={
        correcao
          ? "O Redator reescreve a versão devolvida aplicando os seus motivos, sem nova pesquisa; depois o Revisor confere. O resultado volta para a sua revisão como nova versão."
          : "Dispara o produtor para a etapa automática pendente. Cada etapa reserva suas chamadas antes de executar."
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={fechar} disabled={enviando}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!autorizo || enviando || maxChamadas === 0} onClick={() => void enviar()}>
            <Bot className="h-4 w-4" aria-hidden /> {correcao ? "Autorizar e iniciar correção" : "Autorizar e iniciar"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {correcao ? (
          <section aria-labelledby="motivos-titulo">
            <h3 id="motivos-titulo" className="field-label">Motivos enviados ao Redator</h3>
            {d && d.motivos.length ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {d.motivos.map((m, i) => (
                  <li key={i} className="whitespace-pre-wrap">{m}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">A devolução não tem motivos legíveis.</p>
            )}
            {d ? (
              <p className="field-hint">
                Devolução de {d.nome} em {formatDateTime(d.em)}. Para mudar os motivos, registre uma nova devolução antes de solicitar a correção.
              </p>
            ) : null}
          </section>
        ) : null}

        {simulado ? (
          <Notice tone="warning">Registro de teste com execução simulada: as etapas usam respostas preservadas, sem chamadas de IA nem cobrança.</Notice>
        ) : (
          <section aria-labelledby="custo-titulo" className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-3 text-sm">
            <h3 id="custo-titulo" className="mb-1 flex items-center gap-1.5 font-semibold text-amber-950">
              <Coins className="h-4 w-4" aria-hidden /> Chamadas pagas de API
            </h3>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                Até <strong>{maxChamadas}</strong> chamada(s) nesta ação:{" "}
                {etapas.map((e) => `${NOME[e]} (${CHAMADAS_POR_ETAPA[e]})`).join(" + ")}.
              </li>
              <li>
                Já registradas neste trabalho: {reservadas} reservada(s), {com_uso_confirmado} com uso confirmado
                {limite_do_ciclo !== null && !correcao ? ` · limite do ciclo: ${limite_do_ciclo}` : ""}.
              </li>
              <li>A fila reserva cada chamada antes de executar e não repete sozinha em caso de falha.</li>
              <li>Valor em reais: não informado pela fila.</li>
            </ul>
          </section>
        )}

        <Notice tone="info">
          As etapas rodam em segundo plano no n8n (limite de 30 min por execução do produtor). Esta tela acompanha o registro sem ocupar a trava da fila.
        </Notice>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} />
          <span>{textoAutorizacao}</span>
        </label>

        <ActionError error={erro} />
      </div>
    </Dialog>
  );
}
