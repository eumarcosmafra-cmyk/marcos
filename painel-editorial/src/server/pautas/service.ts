import "server-only";
import type { Ambiente, TrabalhoResumoDTO } from "@/lib/fila-types";
import type { ListaPautasDTO, PautaDTO } from "@/lib/pautas-types";
import type { SessionUser } from "../auth/session";
import { PainelError } from "../painel-error";
import { opId } from "../fila/inputs";
import { assertAmbiente, chamar, dispararProdutor, erroDeDisparo, listarFila } from "../fila/service";
import { isRec } from "../fila/sanitize";
import { planoCacheKey, type ProduzirBody, type ProporFontesBody } from "./inputs";
import { sanitizePautas } from "./sanitize";

/** Planos e pautas do cliente, com o estado das fontes e os trabalhos já criados na fila. */
export async function listarPautas(user: SessionUser): Promise<ListaPautasDTO> {
  const raw = await chamar("listar_pautas", { cliente_id: user.cliente_id }, 1);
  const fila: Partial<Record<Ambiente, TrabalhoResumoDTO[]>> = {};
  for (const amb of user.ambientes) {
    try {
      fila[amb] = (await listarFila(user, amb)).trabalhos;
    } catch (e) {
      // A lista de pautas continua útil sem a fila; o painel avisa que o vínculo não foi conferido.
      console.error("[pautas] Fila indisponível ao listar pautas:", amb, e instanceof PainelError ? e.code : e);
    }
  }
  return sanitizePautas(raw, fila);
}

async function obterPauta(user: SessionUser, planoId: string, pautaId: string): Promise<PautaDTO> {
  const lista = await listarPautas(user);
  const pauta = lista.planos.find((p) => p.plano_id === planoId)?.pautas.find((p) => p.id === pautaId);
  if (!pauta) throw new PainelError("PAUTA_NAO_ENCONTRADA", "Pauta não encontrada neste plano.", 404);
  return pauta;
}

/** Dispara a curadoria (coleta + escolha pelo modelo) em segundo plano. */
export async function proporFontes(user: SessionUser, planoId: string, pautaId: string, body: ProporFontesBody): Promise<{ proposta_iniciada: boolean }> {
  const r = await chamar(
    "propor_fontes",
    { cliente_id: user.cliente_id, plano_cache_key: planoCacheKey(user.cliente_id, planoId), pauta_id: pautaId, ator_id: user.ator_id, autorizar_cobranca: true, urls_extras: body.urls_extras },
    1,
  );
  if (!isRec(r) || r.proposta_iniciada !== true) throw new PainelError("N8N_RESPOSTA_INVALIDA", "O adaptador não confirmou o início da busca de fontes.", 502);
  return { proposta_iniciada: true };
}

export async function aprovarFontes(user: SessionUser, planoId: string, pautaId: string): Promise<{ aprovada: boolean }> {
  const r = await chamar("aprovar_fontes", { cliente_id: user.cliente_id, plano_cache_key: planoCacheKey(user.cliente_id, planoId), pauta_id: pautaId, ator_id: user.ator_id }, 1);
  if (!isRec(r) || r.ok !== true) throw new PainelError("N8N_RESPOSTA_INVALIDA", "A aprovação das fontes não foi confirmada.", 502);
  return { aprovada: true };
}

export interface ResultadoProduzir {
  job_key: string;
  ambiente: Ambiente;
  revisao: number;
  resultado_reutilizado: boolean;
  producao_iniciada: boolean;
  erro_producao: { codigo: string; mensagem: string } | null;
}

/**
 * Enfileira a pauta (Enfileirador monta o pacote sem IA, com as fontes aprovadas) e dispara o produtor.
 * Antes, confere fontes aprovadas e que a pauta ainda não tem trabalho neste ambiente.
 */
export async function produzirPauta(user: SessionUser, planoId: string, pautaId: string, body: ProduzirBody): Promise<ResultadoProduzir> {
  assertAmbiente(user, body.ambiente);
  const pauta = await obterPauta(user, planoId, pautaId);
  if (pauta.fontes.estado !== "aprovada") throw new PainelError("PAUTA_SEM_FONTES", "Aprove as 3 fontes da pauta antes de produzir.", 422);
  const existente = pauta.trabalhos.find((t) => t.ambiente === body.ambiente);
  if (existente) {
    throw new PainelError("PAUTA_JA_NA_FILA", "Esta pauta já tem um trabalho neste ambiente.", 409, { job_key: existente.job_key });
  }
  const r = await chamar(
    "enfileirar_pauta",
    { cliente_id: user.cliente_id, ambiente: body.ambiente, plano_cache_key: planoCacheKey(user.cliente_id, planoId), pauta_id: pautaId, ator_id: user.ator_id, op_id: opId(user, body.op_uuid) },
    3,
  );
  if (!isRec(r) || typeof r.job_key !== "string" || typeof r.revisao !== "number") {
    throw new PainelError("FILA_RESPOSTA_INVALIDA", "O Enfileirador respondeu sem a chave do trabalho.", 502);
  }
  const base = { job_key: r.job_key, ambiente: body.ambiente, revisao: r.revisao, resultado_reutilizado: r.resultado_reutilizado === true };
  try {
    await dispararProdutor(user, body.ambiente, r.job_key, r.revisao);
    return { ...base, producao_iniciada: true, erro_producao: null };
  } catch (e) {
    console.error("[pautas] Pauta enfileirada, mas o produtor não iniciou:", e instanceof PainelError ? e.code : e);
    return { ...base, producao_iniciada: false, erro_producao: erroDeDisparo(e) };
  }
}
