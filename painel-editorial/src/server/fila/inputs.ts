/**
 * Montagem das entradas de mutação enviadas ao adaptador.
 *
 * O navegador envia só o que é dele decidir (texto, decisão, motivos,
 * justificativa, identificação da versão que viu e um identificador da tentativa).
 * cliente_id, ator_id e o formato final do op_id vêm da sessão — campos com
 * esses nomes no corpo são recusados pelo esquema estrito.
 */
import { z } from "zod";
import type { Ambiente } from "@/lib/fila-types";
import type { SessionUser } from "../auth/session";
import { PainelError } from "../painel-error";

const hex64 = z.string().regex(/^[a-f0-9]{64}$/, "hash inválido");
const opUuid = z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "identificador da operação inválido");

export const edicaoSchema = z
  .object({
    op_uuid: opUuid,
    revisao_esperada: z.number().int().min(1),
    artigo_sha256: hex64,
    markdown: z.string().min(200, "O artigo precisa ter ao menos 200 caracteres.").max(800000),
  })
  .strict();

export const decisaoSchema = z
  .object({
    op_uuid: opUuid,
    decisao: z.enum(["aprovar", "devolver"]),
    revisao_esperada: z.number().int().min(1),
    artigo_sha256: hex64,
    confirmo_revisao_editorial: z.literal(true, { errorMap: () => ({ message: "Confirme a revisão editorial da versão exibida." }) }),
    motivos: z.array(z.string().trim().min(5, "Cada motivo precisa de ao menos 5 caracteres.").max(3000)).max(20).default([]),
    pendencias_sha256: hex64.optional(),
    justificativa_pendencias: z.string().trim().max(3000).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.decisao === "devolver" && d.motivos.length === 0) {
      ctx.addIssue({ code: "custom", path: ["motivos"], message: "A devolução exige ao menos um motivo." });
    }
    if (d.justificativa_pendencias !== undefined && !d.pendencias_sha256) {
      ctx.addIssue({ code: "custom", path: ["pendencias_sha256"], message: "Justificativa sem a identificação das pendências avaliadas." });
    }
    if (d.pendencias_sha256 && (!d.justificativa_pendencias || d.justificativa_pendencias.length < 20)) {
      ctx.addIssue({ code: "custom", path: ["justificativa_pendencias"], message: "Escreva uma justificativa com ao menos 20 caracteres para as pendências." });
    }
  });

const autorizoChamadas = z.literal(true, {
  errorMap: () => ({ message: "Marque a autorização explícita das chamadas de API antes de iniciar a etapa." }),
});

/** Correção a partir da devolução vigente: a fila consome os motivos já registrados. */
export const correcaoSchema = z
  .object({
    op_uuid: opUuid,
    revisao_esperada: z.number().int().min(1),
    artigo_sha256: hex64,
    autorizo_chamadas_pagas: autorizoChamadas,
  })
  .strict();

/** Disparo do produtor para a etapa pendente (sem op_id: o produtor gera os seus por execução). */
export const producaoSchema = z
  .object({
    revisao_esperada: z.number().int().min(1),
    autorizo_chamadas_pagas: autorizoChamadas,
  })
  .strict();

export type EdicaoBody = z.infer<typeof edicaoSchema>;
export type CorrecaoBody = z.infer<typeof correcaoSchema>;
export type ProducaoBody = z.infer<typeof producaoSchema>;
export type DecisaoBody = z.infer<typeof decisaoSchema>;

export function parseBody<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new PainelError("PEDIDO_INVALIDO", issue?.message ?? "Pedido inválido.", 400, { campo: issue?.path.join(".") ?? "" });
  }
  return r.data;
}

export function opId(user: SessionUser, uuid: string): string {
  return `painel:${user.ator_id}:${uuid}`;
}

export function assertJobKey(jobKey: string): void {
  if (!/^[a-f0-9]{64}$/.test(jobKey)) throw new PainelError("CHAVE_INVALIDA", "Identificador de trabalho inválido.", 400);
}

export function buildEdicao(user: SessionUser, ambiente: Ambiente, jobKey: string, body: EdicaoBody): Record<string, unknown> {
  assertJobKey(jobKey);
  return {
    cliente_id: user.cliente_id,
    ambiente,
    job_key: jobKey,
    op_id: opId(user, body.op_uuid),
    revisao_esperada: body.revisao_esperada,
    artigo_sha256: body.artigo_sha256,
    markdown: body.markdown,
    ator_id: user.ator_id,
  };
}

export function buildDecisao(user: SessionUser, ambiente: Ambiente, jobKey: string, body: DecisaoBody): Record<string, unknown> {
  assertJobKey(jobKey);
  const entrada: Record<string, unknown> = {
    cliente_id: user.cliente_id,
    ambiente,
    job_key: jobKey,
    op_id: opId(user, body.op_uuid),
    revisao_esperada: body.revisao_esperada,
    artigo_sha256: body.artigo_sha256,
    decisao: body.decisao,
    confirmo_revisao_editorial: true,
    motivos: body.motivos,
    ator_id: user.ator_id,
  };
  if (body.pendencias_sha256) {
    entrada.pendencias_sha256 = body.pendencias_sha256;
    entrada.justificativa_pendencias = body.justificativa_pendencias;
  }
  return entrada;
}

export function buildCorrecao(user: SessionUser, ambiente: Ambiente, jobKey: string, body: CorrecaoBody): Record<string, unknown> {
  assertJobKey(jobKey);
  return {
    cliente_id: user.cliente_id,
    ambiente,
    job_key: jobKey,
    op_id: opId(user, body.op_uuid),
    revisao_esperada: body.revisao_esperada,
    artigo_sha256: body.artigo_sha256,
    autorizar_cobranca: true,
    ator_id: user.ator_id,
  };
}

export function buildProducao(user: SessionUser, ambiente: Ambiente, jobKey: string, revisaoEsperada: number): Record<string, unknown> {
  assertJobKey(jobKey);
  return {
    cliente_id: user.cliente_id,
    ambiente,
    job_key: jobKey,
    revisao_esperada: revisaoEsperada,
    autorizar_cobranca: true,
    ator_id: user.ator_id,
  };
}
