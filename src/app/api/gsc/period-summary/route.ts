import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSearchAnalytics, matchDomainToGSCSite, getGSCSites } from "@/lib/gsc-client";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }

    const { domain, currentPeriod, previousPeriod } = await request.json();

    if (!domain || !currentPeriod?.startDate || !currentPeriod?.endDate || !previousPeriod?.startDate || !previousPeriod?.endDate) {
      return NextResponse.json({ error: "domain, currentPeriod e previousPeriod obrigatórios" }, { status: 400 });
    }

    const sites = await getGSCSites(session.accessToken);
    const siteUrl = matchDomainToGSCSite(domain, sites);
    if (!siteUrl) {
      return NextResponse.json({ error: "Site não encontrado no GSC" }, { status: 404 });
    }

    type Row = { clicks?: number; impressions?: number };
    const sumMetrics = (rows: Row[]) => ({
      clicks: rows.reduce((s, r) => s + (r.clicks || 0), 0),
      impressions: rows.reduce((s, r) => s + (r.impressions || 0), 0),
    });

    const [currentRows, previousRows] = await Promise.all([
      getSearchAnalytics(session.accessToken, siteUrl, {
        startDate: currentPeriod.startDate,
        endDate: currentPeriod.endDate,
        dimensions: ["query"],
        rowLimit: 25000,
      }),
      getSearchAnalytics(session.accessToken, siteUrl, {
        startDate: previousPeriod.startDate,
        endDate: previousPeriod.endDate,
        dimensions: ["query"],
        rowLimit: 25000,
      }),
    ]);

    const current = sumMetrics(currentRows as Row[]);
    const previous = sumMetrics(previousRows as Row[]);

    const delta = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;

    return NextResponse.json({
      current,
      previous,
      deltas: {
        clicks: delta(current.clicks, previous.clicks),
        impressions: delta(current.impressions, previous.impressions),
      },
    });
  } catch (error) {
    console.error("[gsc/period-summary] Error:", error);
    return NextResponse.json({ error: "Erro ao buscar dados do GSC" }, { status: 500 });
  }
}
