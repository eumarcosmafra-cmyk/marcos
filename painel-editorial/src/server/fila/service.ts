import "server-only";
import { z } from "zod";
import type { Ambiente, TrabalhoDTO, TrabalhoResumoDTO, VersaoTextoDTO } from "@/lib/fila-types";
import { podeDecidir, type SessionUser } from "../auth/session";
import { PainelError } from "../painel-error";
import { callAdapter, type AdapterEnvelope, type AdapterOperation } from "../n8n/adapter-client";
import { buildDecisao, buildEdicao, type DecisaoBody, type EdicaoBody } from "./inputs";
import { isRec, sanitizeResumo, sanitizeResumos, sanitizeTrabalho, type ResumoLeitura } from "./sanitize";
import { mapQueueError } from "./errors";

type Op = AdapterOperation;

export const ambienteSchema = z.enum(["producao", "teste"]);

function assertAmbiente(user: SessionUser, ambiente: Ambiente): void {
  if (!user.ambientes.includes(ambiente)) throw new PainelError("AMBIENTE_NAO_PERMITIDO", "Seu usuário não acessa este ambiente.", 403);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chama o adaptador e devolve `resultado`, convertendo recusas da fila em erros com código. */
async function chamar(operacao: Op, entrada: Record<string, unknown>, tentativas = 1): Promise<unknown> {
  let ultimo: PainelError | null = null;
  for (let i = 0; i < tentativas; i += 1) {
    const env: AdapterEnvelope = await callAdapter(operacao, entrada);
    if (env.ok === true) return env.resultado;
    const erro = isRec(env.erro) ? env.erro : { codigo: String(env.erro ?? "erro_desconhecido") };
    const mapped = mapQueueError(String(erro.codigo ?? "erro_desconhecido"), String(erro.mensagem ?? ""));
    // A trava global da fila pode estar ocupada por outra operação: nada foi executado, então é seguro tentar de novo.
    if (mapped.code === "FILA_OCUPADA" && i < tentativas - 1) {
      ultimo = mapped;
      await sleep(700 * (i + 1));
      continue;
    }
    throw mapped;
  }
  throw ultimo ?? new PainelError("FILA_OCUPADA", "A fila está ocupada por outra operação.", 503);
}

async function resumos(user: SessionUser, ambiente: Ambiente): Promise<Map<string, ResumoLeitura>> {
  try {
    return sanitizeResumos(await chamar("ler_resumos", { cliente_id: user.cliente_id, ambiente }));
  } catch (e) {
    // Títulos são complementares: a lista oficial continua valendo sem eles.
    console.error("[fila] Leitura de títulos falhou:", e instanceof PainelError ? e.code : e);
    return new Map();
  }
}

export async function listarFila(user: SessionUser, ambiente: Ambiente): Promise<{ trabalhos: TrabalhoResumoDTO[]; titulos_disponiveis: boolean }> {
  assertAmbiente(user, ambiente);
  const brutos: unknown[] = [];
  let cursor: number | null = 0;
  for (let pagina = 0; pagina < 20 && cursor !== null; pagina += 1) {
    const entrada: Record<string, unknown> = { cliente_id: user.cliente_id, ambiente };
    if (cursor) entrada.cursor = cursor;
    const r = await chamar("consultar", entrada, 2);
    if (!isRec(r) || !Array.isArray(r.trabalhos)) throw new PainelError("FILA_RESPOSTA_INVALIDA", "A fila respondeu sem a lista de trabalhos.", 502);
    brutos.push(...r.trabalhos);
    cursor = typeof r.proximo_cursor === "number" ? r.proximo_cursor : null;
  }
  const extras = await resumos(user, ambiente);
  const trabalhos = brutos
    .map((t) => sanitizeResumo(t, ambiente, isRec(t) && typeof t.job_key === "string" ? extras.get(t.job_key) : undefined))
    .filter((t): t is TrabalhoResumoDTO => t !== null);
  return { trabalhos, titulos_disponiveis: extras.size > 0 };
}

export async function obterTrabalho(user: SessionUser, ambiente: Ambiente, jobKey: string): Promise<TrabalhoDTO> {
  assertAmbiente(user, ambiente);
  const r = await chamar("consultar", { cliente_id: user.cliente_id, ambiente, job_key: jobKey }, 3);
  const extra = (await resumos(user, ambiente)).get(jobKey);
  const t = sanitizeTrabalho(r, ambiente, podeDecidir(user), extra);
  if (!t || t.job_key !== jobKey) throw new PainelError("FILA_RESPOSTA_INVALIDA", "A fila respondeu com outro trabalho ou formato inesperado.", 502);
  return t;
}

export async function lerVersao(user: SessionUser, ambiente: Ambiente, jobKey: string, numero: number): Promise<VersaoTextoDTO> {
  assertAmbiente(user, ambiente);
  const r = await chamar("ler_versao", { cliente_id: user.cliente_id, ambiente, job_key: jobKey, numero }, 1);
  const v = isRec(r) && isRec(r.versao) ? r.versao : null;
  if (!v || typeof v.markdown !== "string" || v.numero !== numero) throw new PainelError("FILA_RESPOSTA_INVALIDA", "Versão em formato inesperado.", 502);
  return {
    numero,
    sha256: String(v.sha256 ?? ""),
    origem: String(v.origem ?? ""),
    em: String(v.em ?? ""),
    completa: v.completa === true,
    markdown: v.markdown,
    sha256_confere: v.sha256_confere === true,
  };
}

export interface ResultadoMutacao {
  resultado_reutilizado: boolean;
  estado: string;
  revisao: number;
  versao_artigo: number;
}

function resumoMutacao(r: unknown): ResultadoMutacao {
  if (!isRec(r)) throw new PainelError("FILA_RESPOSTA_INVALIDA", "A fila respondeu em formato inesperado.", 502);
  return {
    resultado_reutilizado: r.resultado_reutilizado === true,
    estado: String(r.estado ?? ""),
    revisao: typeof r.revisao === "number" ? r.revisao : 0,
    versao_artigo: typeof r.versao_artigo === "number" ? r.versao_artigo : 0,
  };
}

export async function salvarEdicao(user: SessionUser, ambiente: Ambiente, jobKey: string, body: EdicaoBody): Promise<ResultadoMutacao> {
  assertAmbiente(user, ambiente);
  const entrada = buildEdicao(user, ambiente, jobKey, body);
  return resumoMutacao(await chamar("salvar_edicao", entrada, 3));
}

export async function decidir(user: SessionUser, ambiente: Ambiente, jobKey: string, body: DecisaoBody): Promise<ResultadoMutacao> {
  assertAmbiente(user, ambiente);
  const entrada = buildDecisao(user, ambiente, jobKey, body);
  return resumoMutacao(await chamar("decidir", entrada, 3));
}
