import { NextResponse, type NextRequest } from "next/server";
import { assertJobKey } from "@/server/fila/inputs";
import { ambienteSchema, lerVersao } from "@/server/fila/service";
import { errorResponse, PainelError, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobKey: string; numero: string }> }) {
  try {
    const user = await requireUser();
    const { jobKey, numero } = await ctx.params;
    assertJobKey(jobKey);
    const n = Number(numero);
    if (!Number.isSafeInteger(n) || n < 1) throw new PainelError("VERSAO_INVALIDA", "Número de versão inválido.", 400);
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente"));
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Informe o ambiente (producao ou teste).", 400);
    const versao = await lerVersao(user, amb.data, jobKey, n);
    return NextResponse.json({ ok: true, versao }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
