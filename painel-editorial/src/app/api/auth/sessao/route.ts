import { NextResponse } from "next/server";
import { podeDecidir } from "@/server/auth/session";
import { errorResponse, requireUser } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await requireUser();
    return NextResponse.json(
      { ok: true, usuario: { nome: u.nome, papel: u.papel, cliente_id: u.cliente_id, ambientes: u.ambientes, pode_decidir: podeDecidir(u) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
