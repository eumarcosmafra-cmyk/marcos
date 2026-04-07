import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGSCSites, getSiteOverview, matchDomainToGSCSite } from "@/lib/gsc-client";
import { getGA4EcommerceData } from "@/lib/ga4-client";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }
    const { id } = await params;

    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, domain: true, ga4PropertyId: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 27);
    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    // GSC
    let gsc: unknown = null;
    try {
      const sites = await getGSCSites(session.accessToken);
      const siteUrl = matchDomainToGSCSite(client.domain, sites);
      if (siteUrl) {
        const overview = await getSiteOverview(session.accessToken, siteUrl, startDate, endDate);
        gsc = {
          siteUrl,
          totalClicks: overview.totalClicks,
          totalImpressions: overview.totalImpressions,
          avgCtr: overview.avgCtr,
          avgPosition: overview.avgPosition,
          topQueries: overview.topQueries.slice(0, 10),
          topPages: overview.topPages.slice(0, 10),
          dailyData: overview.dailyData,
        };
      }
    } catch (e) {
      console.error("[snapshot] GSC error:", e);
    }

    // GA4 ecommerce
    let ga4: unknown = null;
    let ga4Pages: unknown = null;
    if (client.ga4PropertyId) {
      try {
        const ecom = await getGA4EcommerceData(session.accessToken, client.ga4PropertyId, { startDate, endDate });
        ga4 = ecom;

        // Organic pages
        const oauth2 = new google.auth.OAuth2();
        oauth2.setCredentials({ access_token: session.accessToken });
        const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2 });
        const pageRes = await analyticsdata.properties.runReport({
          property: client.ga4PropertyId,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
            metrics: [
              { name: "sessions" },
              { name: "purchaseRevenue" },
              { name: "transactions" },
            ],
            dimensionFilter: {
              filter: {
                fieldName: "sessionDefaultChannelGroup",
                stringFilter: { matchType: "EXACT", value: "Organic Search" },
              },
            },
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: "20",
          },
        });
        ga4Pages = (pageRes.data.rows || []).map((row) => ({
          pagePath: row.dimensionValues?.[0]?.value || "",
          pageTitle: row.dimensionValues?.[1]?.value || "",
          sessions: parseInt(row.metricValues?.[0]?.value || "0"),
          revenue: parseFloat(row.metricValues?.[1]?.value || "0"),
          transactions: parseInt(row.metricValues?.[2]?.value || "0"),
        }));
      } catch (e) {
        console.error("[snapshot] GA4 error:", e);
      }
    }

    const snapshot = { period: { startDate, endDate }, gsc, ga4, ga4Pages };
    const updated = await prisma.client.update({
      where: { id },
      data: { analyticsSnapshot: snapshot as object, snapshotUpdatedAt: new Date() },
      select: { snapshotUpdatedAt: true },
    });

    return NextResponse.json({ ok: true, snapshotUpdatedAt: updated.snapshotUpdatedAt });
  } catch (error) {
    console.error("[clients/[id]/snapshot] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
