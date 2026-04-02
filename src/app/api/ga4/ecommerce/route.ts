import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGA4Comparison } from "@/lib/ga4-client";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Token não encontrado. Faça login novamente." }, { status: 401 });
    }

    const { clientId, currentPeriod, previousPeriod } = await request.json();

    if (!clientId || !currentPeriod?.startDate || !currentPeriod?.endDate) {
      return NextResponse.json({ error: "clientId e currentPeriod obrigatórios" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { ga4PropertyId: true },
    });

    if (!client?.ga4PropertyId) {
      return NextResponse.json({ error: "GA4 não configurado. Adicione o Property ID nas configurações do cliente." }, { status: 400 });
    }

    const prevPeriod = previousPeriod || {
      startDate: calcPrevStart(currentPeriod),
      endDate: calcPrevEnd(currentPeriod),
    };

    const data = await getGA4Comparison(session.accessToken, client.ga4PropertyId, currentPeriod, prevPeriod);
    return NextResponse.json({ data, propertyId: client.ga4PropertyId });
  } catch (error) {
    console.error("[ga4/ecommerce] Error:", error);
    const msg = error instanceof Error ? error.message : "Erro interno";
    if (msg.includes("403") || msg.includes("insufficient")) {
      return NextResponse.json({ error: "Sem permissão GA4. Faça logout e login novamente." }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function calcPrevStart(current: { startDate: string; endDate: string }): string {
  const s = new Date(current.startDate);
  const e = new Date(current.endDate);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000);
  const prev = new Date(s);
  prev.setDate(prev.getDate() - days - 1);
  return prev.toISOString().split("T")[0];
}

function calcPrevEnd(current: { startDate: string; endDate: string }): string {
  const s = new Date(current.startDate);
  s.setDate(s.getDate() - 1);
  return s.toISOString().split("T")[0];
}
