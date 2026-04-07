import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientSession } from "@/lib/client-auth";

export async function GET(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
      select: {
        id: true,
        name: true,
        domain: true,
        ga4PropertyId: true,
        analyticsSnapshot: true,
        snapshotUpdatedAt: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const snapshot = client.analyticsSnapshot as Record<string, unknown> | null;
    if (!snapshot || !snapshot.dashboard) {
      return NextResponse.json({
        error: "Dashboard ainda não foi gerado pelo seu consultor.",
        client: { name: client.name, domain: client.domain, ga4PropertyId: client.ga4PropertyId },
      }, { status: 200 });
    }

    // Latest report for analyst notes
    const latestReport = await prisma.clientReport.findFirst({
      where: { clientId: session.clientId },
      orderBy: { createdAt: "desc" },
      select: { analystNotes: true, period: true, createdAt: true },
    });

    // Open critical alerts
    const alerts = await prisma.alert.findMany({
      where: { clientId: session.clientId, status: "OPEN", severity: { in: ["WARNING", "CRITICAL"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, severity: true, type: true, title: true, message: true, createdAt: true },
    });

    return NextResponse.json({
      client: { name: client.name, domain: client.domain, ga4PropertyId: client.ga4PropertyId },
      period: snapshot.period,
      requestedPeriod: startDate && endDate ? { startDate, endDate } : null,
      kpis: (snapshot.dashboard as Record<string, unknown>).kpis,
      products: (snapshot.dashboard as Record<string, unknown>).products,
      categories: (snapshot.dashboard as Record<string, unknown>).categories,
      blocks: (snapshot.dashboard as Record<string, unknown>).blocks,
      highlights: (snapshot.dashboard as Record<string, unknown>).highlights,
      topPages: snapshot.ga4Pages || [],
      analystNotes: latestReport?.analystNotes || null,
      latestReport,
      alerts,
      snapshotUpdatedAt: client.snapshotUpdatedAt,
    });
  } catch (error) {
    console.error("[portal/organic-revenue] Error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
