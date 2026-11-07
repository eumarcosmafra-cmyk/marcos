import { NextResponse, type NextRequest } from "next/server";
import { assertJobKey, correcaoSchema, parseBody } from "@/server/fila/inputs";
import { ambienteSchema, solicitarCorrecao } from "@/server/fila/service";
import { assertSameOrigin, errorResponse, PainelError, readJson, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Transforma a devolução vigente em correção (Redator + Revisor) com autorização explícita de chamadas pagas. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobKey: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { jobKey } = await ctx.params;
    assertJobKey(jobKey);
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente"));
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Informe o ambiente (producao ou teste).", 400);
    const body = parseBody(correcaoSchema, await readJson(req, 8 * 1024));
    const r = await solicitarCorrecao(user, amb.data, jobKey, body);
    console.info("[fila] Correção autorizada", {
      ator: user.ator_id,
      ambiente: amb.data,
      job: jobKey.slice(0, 8),
      revisao: r.correcao?.revisao,
      reutilizado: r.correcao?.resultado_reutilizado,
      producao_iniciada: r.producao_iniciada,
      erro_producao: r.erro_producao?.codigo,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
