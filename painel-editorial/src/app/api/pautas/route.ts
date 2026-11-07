import { NextResponse } from "next/server";
import { listarPautas } from "@/server/pautas/service";
import { errorResponse, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const lista = await listarPautas(user);
    return NextResponse.json({ ok: true, ...lista, consultado_em: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
