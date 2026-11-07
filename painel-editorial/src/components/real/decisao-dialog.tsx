"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Ambiente, TrabalhoDTO } from "@/lib/fila-types";
import { Dialog, Notice } from "@/components/ui";
import { api, ApiError, novoOpUuid } from "./api";
import { ActionError } from "./load-state";

interface Tentativa {
  uuid: string;
  chave: string;
  incerta: boolean;
}

export function DecisaoDialog({
  trabalho,
  ambiente,
  tipo,
  onClose,
  onDone,
}: {
  trabalho: TrabalhoDTO;
  ambiente: Ambiente;
  tipo: "aprovar" | "devolver" | null;
  onClose: () => void;
  onDone: (mensagem: string) => void;
}) {
  const [motivos, setMotivos] = useState<string[]>([""]);
  const [avaliadas, setAvaliadas] = useState<boolean[]>(() => trabalho.pendencias.map(() => false));
  const [justificativa, setJustificativa] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState<Tentativa | null>(null);

  const aprovar = tipo === "aprovar";
  const exigePendencias = aprovar && trabalho.acoes.exige_avaliacao_pendencias;
  const motivosValidos = motivos.map((m) => m.trim()).filter((m) => m.length > 0);
  const motivoCurto = motivosValidos.some((m) => m.length < 5);
  const todasAvaliadas = avaliadas.every(Boolean);
  const justificativaOk = justificativa.trim().length >= 20;

  const podeEnviar =
    confirmo &&
    !enviando &&
    (aprovar ? !exigePendencias || (todasAvaliadas && justificativaOk) : motivosValidos.length > 0 && !motivoCurto);

  const fechar = () => {
    if (enviando) return;
    setErro(null);
    onClose();
  };

  const enviar = async () => {
    const corpo: Record<string, unknown> = {
      decisao: tipo,
      revisao_esperada: trabalho.revisao,
      artigo_sha256: trabalho.artigo_sha256,
      confirmo_revisao_editorial: true,
      motivos: aprovar ? [] : motivosValidos,
    };
    if (exigePendencias) {
      corpo.pendencias_sha256 = trabalho.pendencias_sha256;
      corpo.justificativa_pendencias = justificativa.trim();
    }
    const chave = JSON.stringify(corpo);
    // Reaproveita o identificador só quando a tentativa anterior, idêntica, teve resultado incerto.
    const uuid = tentativa && tentativa.chave === chave && tentativa.incerta ? tentativa.uuid : novoOpUuid();
    setTentativa({ uuid, chave, incerta: false });
    setEnviando(true);
    setErro(null);
    try {
      const r = await api<{ resultado_reutilizado: boolean; estado: string; revisao: number }>(
        `/api/fila/${trabalho.job_key}/decisao?ambiente=${ambiente}`,
        { method: "POST", body: { ...corpo, op_uuid: uuid } },
      );
      setTentativa(null);
      onDone(
        aprovar
          ? ambiente === "teste"
            ? "Aprovação simulada registrada no ambiente de teste."
            : `Aprovação editorial registrada (revisão ${r.revisao}). Revisão do professor e publicação continuam pendentes.`
          : `Devolução registrada com ${motivosValidos.length} motivo(s) (revisão ${r.revisao}).`,
      );
    } catch (e) {
      console.error("[decisao] Falha:", e);
      setErro(e);
      if (e instanceof ApiError && e.resultadoIncerto) setTentativa({ uuid, chave, incerta: true });
    } finally {
      setEnviando(false);
    }
  };

  const atual = `v${trabalho.versao_artigo} (${(trabalho.artigo_sha256 ?? "").slice(0, 12)}…)`;

  return (
    <Dialog
      open={tipo !== null}
      onClose={fechar}
      size="lg"
      title={aprovar ? `Aprovar editorialmente a ${atual}` : `Devolver a ${atual}`}
      description={
        aprovar
          ? "Aprovação editorial não é revisão do professor nem autorização de publicação."
          : "Explique o que precisa mudar. Os motivos ficam registrados na fila."
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={fechar} disabled={enviando}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!podeEnviar} onClick={() => void enviar()}>
            {aprovar ? "Registrar aprovação editorial" : "Registrar devolução"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {ambiente === "teste" ? (
          <Notice tone="warning">Ambiente de teste: a decisão fica registrada como simulação.</Notice>
        ) : (
          <Notice tone="info">Ambiente de produção: a decisão será registrada em nome do editor responsável da sessão.</Notice>
        )}

        {exigePendencias ? (
          <fieldset className="rounded-md border border-amber-300 bg-amber-50/50 px-3 py-3">
            <legend className="px-1 text-sm font-semibold text-amber-950">Pendências do Revisor ({trabalho.pendencias.length}) — avalie cada uma</legend>
            <ul className="flex flex-col gap-2">
              {trabalho.pendencias.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <input
                    id={`pend-${i}`}
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={avaliadas[i] ?? false}
                    onChange={(e) => setAvaliadas((a) => a.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <label htmlFor={`pend-${i}`}>
                    <span className="font-medium">Pendência {i + 1}: </span>
                    {p}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <label htmlFor="justificativa" className="field-label">
                Justificativa para aprovar com estas pendências <span className="text-red-700">*</span>
              </label>
              <textarea
                id="justificativa"
                className="input"
                rows={4}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Escreva sua avaliação (mínimo 20 caracteres)"
              />
              <p className="field-hint">{justificativa.trim().length}/20 caracteres mínimos. Nada é preenchido automaticamente.</p>
            </div>
          </fieldset>
        ) : null}

        {!aprovar ? (
          <fieldset>
            <legend className="field-label">Motivos da devolução <span className="text-red-700">*</span></legend>
            <ul className="flex flex-col gap-2">
              {motivos.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <label htmlFor={`motivo-${i}`} className="sr-only">Motivo {i + 1}</label>
                  <textarea id={`motivo-${i}`} className="input" rows={2} value={m} onChange={(e) => setMotivos((l) => l.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Ex.: rever a seção sobre origem do ritual" />
                  {motivos.length > 1 ? (
                    <button type="button" className="btn-ghost btn-sm mt-1" aria-label={`Remover motivo ${i + 1}`} onClick={() => setMotivos((l) => l.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {motivos.length < 20 ? (
              <button type="button" className="btn-secondary btn-sm mt-2" onClick={() => setMotivos((l) => [...l, ""])}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar motivo
              </button>
            ) : null}
            {motivoCurto ? <p className="field-hint text-red-800">Cada motivo precisa de ao menos 5 caracteres.</p> : null}
          </fieldset>
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
          <span>
            Confirmo que fiz a revisão editorial da {atual}, revisão do registro {trabalho.revisao}.
          </span>
        </label>

        <ActionError error={erro} />
      </div>
    </Dialog>
  );
}
