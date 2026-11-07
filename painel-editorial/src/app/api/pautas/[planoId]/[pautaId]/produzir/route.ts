import { NextResponse, type NextRequest } from "next/server";
import { parseBody } from "@/server/fila/inputs";
import { assertPlanoPauta, produzirSchema } from "@/server/pautas/inputs";
import { produzirPauta } from "@/server/pautas/service";
import { assertSameOrigin, errorResponse, readJson, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enfileira a pauta com as fontes aprovadas e dispara Pesquisador → Redator → Revisor. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ planoId: string; pautaId: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { planoId, pautaId } = await ctx.params;
    assertPlanoPauta(planoId, pautaId);
    const body = parseBody(produzirSchema, await readJson(req, 4 * 1024));
    const r = await produzirPauta(user, planoId, pautaId, body);
    console.info("[pautas] Pauta enviada à produção", { ator: user.ator_id, pauta: pautaId, ambiente: body.ambiente, job: r.job_key.slice(0, 8), reutilizado: r.resultado_reutilizado, producao_iniciada: r.producao_iniciada, erro: r.erro_producao?.codigo });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
