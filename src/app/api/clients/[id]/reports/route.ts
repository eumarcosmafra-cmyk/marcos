import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const reports = await prisma.clientReport.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[client-reports] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar relatórios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: Params) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const report = await prisma.clientReport.create({
      data: {
        clientId: id,
        period: body.period,
        periodType: body.periodType || "trimestral",
        clicks: body.clicks || 0,
        clicksDelta: body.clicksDelta || 0,
        impressions: body.impressions || 0,
        impressionsDelta: body.impressionsDelta || 0,
        revenue: body.revenue || 0,
        cartConversion: body.cartConversion || 0,
        aiScore: body.aiScore || 0,
        aiMentions: body.aiMentions || 0,
        funnelData: body.funnelData || null,
        rankingWins: body.rankingWins || [],
        visualKeywords: body.visualKeywords || [],
        aiPlatforms: body.aiPlatforms || null,
        nextSteps: body.nextSteps || [],
        analystNotes: body.analystNotes || "",
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("[client-reports] POST error:", error);
    return NextResponse.json({ error: "Erro ao criar relatório" }, { status: 500 });
  }
}
