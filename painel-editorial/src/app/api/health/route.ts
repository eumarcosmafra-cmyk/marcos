import { NextResponse } from "next/server";
import { getConfig } from "@/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Healthcheck do container: confirma que o processo responde e que a configuração carrega. */
export async function GET() {
  try {
    const cfg = getConfig();
    return NextResponse.json({ status: "ok", commit: cfg.commit }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health] Configuração inválida:", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "erro", motivo: "configuracao" }, { status: 503 });
  }
}
