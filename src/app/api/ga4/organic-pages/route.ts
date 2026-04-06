import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface GA4OrganicPage {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  revenue: number;
  transactions: number;
  addToCarts: number;
  conversionRate: number;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }

    const { clientId, startDate, endDate } = await request.json();
    if (!clientId || !startDate || !endDate) {
      return NextResponse.json({ error: "clientId, startDate e endDate obrigatórios" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { ga4PropertyId: true },
    });
    if (!client?.ga4PropertyId) {
      return NextResponse.json({ error: "GA4 não configurado para este cliente." }, { status: 400 });
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: session.accessToken });
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2 });

    const response = await analyticsdata.properties.runReport({
      property: client.ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [
          { name: "sessions" },
          { name: "purchaseRevenue" },
          { name: "transactions" },
          { name: "addToCarts" },
          { name: "sessionConversionRate" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Organic Search" },
          },
        },
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "100",
      },
    });

    const pages: GA4OrganicPage[] = (response.data.rows || []).map((row) => {
      const dims = row.dimensionValues || [];
      const mets = row.metricValues || [];
      return {
        pagePath: dims[0]?.value || "",
        pageTitle: dims[1]?.value || dims[0]?.value || "",
        sessions: parseInt(mets[0]?.value || "0"),
        revenue: parseFloat(mets[1]?.value || "0"),
        transactions: parseInt(mets[2]?.value || "0"),
        addToCarts: parseInt(mets[3]?.value || "0"),
        conversionRate: parseFloat(mets[4]?.value || "0"),
      };
    });

    const totals = pages.reduce(
      (acc, p) => ({
        sessions: acc.sessions + p.sessions,
        revenue: acc.revenue + p.revenue,
        transactions: acc.transactions + p.transactions,
      }),
      { sessions: 0, revenue: 0, transactions: 0 }
    );

    return NextResponse.json({ pages, totals });
  } catch (error) {
    console.error("[ga4/organic-pages] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
