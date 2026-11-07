/**
 * Entradas das ações de pauta. O navegador só envia o que é dele decidir (URLs extras,
 * ambiente, autorização). Cliente, editor e plano vêm da sessão e da rota.
 */
import { z } from "zod";
import { PainelError } from "../painel-error";

const autorizo = z.literal(true, { errorMap: () => ({ message: "Marque a autorização explícita das chamadas de API." }) });

export const proporFontesSchema = z
  .object({
    autorizo_chamadas_pagas: autorizo,
    urls_extras: z
      .array(z.string().trim().max(500).regex(/^https:\/\/[^\s/@:]+\/\S*$/, "Use URLs completas com https:// e caminho (ex.: https://site.org/pagina)."))
      .max(5, "No máximo 5 URLs.")
      .default([]),
  })
  .strict();

export const produzirSchema = z
  .object({
    op_uuid: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "identificador da operação inválido"),
    ambiente: z.enum(["producao", "teste"]),
    autorizo_chamadas_pagas: autorizo,
  })
  .strict();

export type ProporFontesBody = z.infer<typeof proporFontesSchema>;
export type ProduzirBody = z.infer<typeof produzirSchema>;

export function assertPlanoPauta(planoId: string, pautaId: string): void {
  if (!/^v2_[a-f0-9]{64}$/.test(planoId)) throw new PainelError("PLANO_INVALIDO", "Identificador de plano inválido.", 400);
  if (!/^P\d{3,6}$/.test(pautaId)) throw new PainelError("PAUTA_INVALIDA", "Identificador de pauta inválido.", 400);
}

export function planoCacheKey(clienteId: string, planoId: string): string {
  return `plano:${clienteId}:${planoId}`;
}
