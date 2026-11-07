import { NextResponse, type NextRequest } from "next/server";
import { assertJobKey, parseBody, producaoSchema } from "@/server/fila/inputs";
import { ambienteSchema, retomarProducao } from "@/server/fila/service";
import { assertSameOrigin, errorResponse, PainelError, readJson, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dispara o produtor para a etapa automática pendente, com autorização explícita de chamadas pagas. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobKey: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { jobKey } = await ctx.params;
    assertJobKey(jobKey);
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente"));
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Informe o ambiente (producao ou teste).", 400);
    const body = parseBody(producaoSchema, await readJson(req, 4 * 1024));
    const r = await retomarProducao(user, amb.data, jobKey, body);
    console.info("[fila] Produção retomada", { ator: user.ator_id, ambiente: amb.data, job: jobKey.slice(0, 8), revisao: body.revisao_esperada });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
