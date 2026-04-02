import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const reports = await prisma.clientReport.findMany({
      where: { clientId: session.clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        period: true,
        periodType: true,
        createdAt: true,
        clicks: true,
        impressions: true,
        revenue: true,
      },
    });

    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
      select: { name: true, domain: true },
    });

    return NextResponse.json({ reports, client });
  } catch (error) {
    console.error("[portal/reports] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
