import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface GA4Item {
  itemName: string;
  itemCategory: string;
  itemsViewed: number;
  addToCarts: number;
  itemsPurchased: number;
  revenue: number;
  revenuePerItem: number;
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
      return NextResponse.json({ error: "GA4 não configurado" }, { status: 400 });
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: session.accessToken });
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2 });

    const res = await analyticsdata.properties.runReport({
      property: client.ga4PropertyId,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "itemName" }, { name: "itemCategory" }],
        metrics: [
          { name: "itemsViewed" },
          { name: "addToCarts" },
          { name: "itemsPurchased" },
          { name: "purchaseRevenue" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "sessionDefaultChannelGroup",
            stringFilter: { matchType: "EXACT", value: "Organic Search" },
          },
        },
        orderBys: [{ metric: { metricName: "purchaseRevenue" }, desc: true }],
        limit: "50",
      },
    });

    const items: GA4Item[] = (res.data.rows || []).map((row) => {
      const dims = row.dimensionValues || [];
      const mets = row.metricValues || [];
      const itemsPurchased = parseInt(mets[2]?.value || "0");
      const revenue = parseFloat(mets[3]?.value || "0");
      return {
        itemName: dims[0]?.value || "(sem nome)",
        itemCategory: dims[1]?.value || "(sem categoria)",
        itemsViewed: parseInt(mets[0]?.value || "0"),
        addToCarts: parseInt(mets[1]?.value || "0"),
        itemsPurchased,
        revenue,
        revenuePerItem: itemsPurchased > 0 ? revenue / itemsPurchased : 0,
      };
    });

    const totals = items.reduce(
      (a, i) => ({
        itemsViewed: a.itemsViewed + i.itemsViewed,
        addToCarts: a.addToCarts + i.addToCarts,
        itemsPurchased: a.itemsPurchased + i.itemsPurchased,
        revenue: a.revenue + i.revenue,
      }),
      { itemsViewed: 0, addToCarts: 0, itemsPurchased: 0, revenue: 0 }
    );

    return NextResponse.json({ items, totals });
  } catch (error) {
    console.error("[ga4/items] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
