import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
      select: {
        name: true,
        domain: true,
        analyticsSnapshot: true,
        snapshotUpdatedAt: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      client: { name: client.name, domain: client.domain },
      snapshot: client.analyticsSnapshot,
      snapshotUpdatedAt: client.snapshotUpdatedAt,
    });
  } catch (error) {
    console.error("[portal/dashboard] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
