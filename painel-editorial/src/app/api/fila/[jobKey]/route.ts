import { NextResponse, type NextRequest } from "next/server";
import { assertJobKey } from "@/server/fila/inputs";
import { ambienteSchema, obterTrabalho } from "@/server/fila/service";
import { errorResponse, PainelError, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ jobKey: string }> }) {
  try {
    const user = await requireUser();
    const { jobKey } = await ctx.params;
    assertJobKey(jobKey);
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente"));
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Informe o ambiente (producao ou teste).", 400);
    const trabalho = await obterTrabalho(user, amb.data, jobKey);
    return NextResponse.json({ ok: true, trabalho, consultado_em: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
