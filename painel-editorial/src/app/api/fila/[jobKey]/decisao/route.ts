import { NextResponse, type NextRequest } from "next/server";
import { assertJobKey, decisaoSchema, parseBody } from "@/server/fila/inputs";
import { ambienteSchema, decidir } from "@/server/fila/service";
import { assertSameOrigin, errorResponse, PainelError, readJson, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobKey: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { jobKey } = await ctx.params;
    assertJobKey(jobKey);
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente"));
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Informe o ambiente (producao ou teste).", 400);
    const body = parseBody(decisaoSchema, await readJson(req, 64 * 1024));
    const r = await decidir(user, amb.data, jobKey, body);
    console.info("[fila] Decisão registrada", { ator: user.ator_id, ambiente: amb.data, job: jobKey.slice(0, 8), decisao: body.decisao, revisao: r.revisao, reutilizado: r.resultado_reutilizado });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
