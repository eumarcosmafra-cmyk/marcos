import { NextResponse, type NextRequest } from "next/server";
import { assertPlanoPauta } from "@/server/pautas/inputs";
import { aprovarFontes } from "@/server/pautas/service";
import { assertSameOrigin, errorResponse, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ planoId: string; pautaId: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { planoId, pautaId } = await ctx.params;
    assertPlanoPauta(planoId, pautaId);
    const r = await aprovarFontes(user, planoId, pautaId);
    console.info("[pautas] Fontes aprovadas", { ator: user.ator_id, plano: planoId.slice(0, 11), pauta: pautaId });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
