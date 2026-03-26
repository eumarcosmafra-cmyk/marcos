import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGSCSites, getSiteOverview, getDateRange } from "@/lib/gsc-client";
import { clientRepository } from "@/repositories/client-repository";

function extractDomain(siteUrl: string): string {
  return siteUrl
    .replace("sc-domain:", "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const sites = await getGSCSites(session.accessToken);
    const syncedClients = [];

    for (const site of sites) {
      const domain = extractDomain(site.siteUrl);

      // Upsert client in DB
      const client = await clientRepository.upsertByDomain(domain, domain);

      // Fetch real GSC data for indicators
      const { startDate, endDate } = getDateRange("28d");
      let indicators;
      try {
        const overview = await getSiteOverview(
          session.accessToken,
          site.siteUrl,
          startDate,
          endDate
        );
        indicators = {
          impressions: overview.totalImpressions,
          clicks: overview.totalClicks,
          ctr: overview.avgCtr,
          position: overview.avgPosition,
        };
      } catch {
        indicators = undefined;
      }

      syncedClients.push({
        id: client.id,
        name: client.name,
        domain: client.domain,
        industry: "",
        status: "active" as const,
        createdAt: client.createdAt.toISOString(),
        gscSiteUrl: site.siteUrl,
        indicators,
      });
    }

    return NextResponse.json({
      synced: syncedClients.length,
      total: syncedClients.length,
      clients: syncedClients,
    });
  } catch (error) {
    console.error("GSC sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync GSC sites" },
      { status: 500 }
    );
  }
}
