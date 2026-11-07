import { NextResponse, type NextRequest } from "next/server";
import { assertPlanoPauta, proporFontesSchema } from "@/server/pautas/inputs";
import { parseBody } from "@/server/fila/inputs";
import { proporFontes } from "@/server/pautas/service";
import { assertSameOrigin, errorResponse, readJson, requireEditor, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Busca e propõe 3 fontes para a pauta (coleta + uma chamada ao modelo), em segundo plano. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ planoId: string; pautaId: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    requireEditor(user);
    const { planoId, pautaId } = await ctx.params;
    assertPlanoPauta(planoId, pautaId);
    const body = parseBody(proporFontesSchema, await readJson(req, 8 * 1024));
    const r = await proporFontes(user, planoId, pautaId, body);
    console.info("[pautas] Busca de fontes iniciada", { ator: user.ator_id, plano: planoId.slice(0, 11), pauta: pautaId, extras: body.urls_extras.length });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return errorResponse(e);
  }
}
