import { NextResponse, type NextRequest } from "next/server";
import { ambienteSchema, listarFila } from "@/server/fila/service";
import { errorResponse, PainelError, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const amb = ambienteSchema.safeParse(req.nextUrl.searchParams.get("ambiente") ?? "producao");
    if (!amb.success) throw new PainelError("AMBIENTE_INVALIDO", "Ambiente deve ser producao ou teste.", 400);
    const r = await listarFila(user, amb.data);
    return NextResponse.json({ ok: true, ambiente: amb.data, ...r, consultado_em: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
