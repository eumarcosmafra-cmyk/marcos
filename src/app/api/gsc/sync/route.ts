import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGSCSites, getSiteOverview, getDateRange } from "@/lib/gsc-client";
import { getClients, addClient } from "@/lib/store";
import { generateId } from "@/lib/utils";

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
    const existingClients = getClients();
    const newClients = [];

    for (const site of sites) {
      const domain = extractDomain(site.siteUrl);
      const exists = existingClients.some(
        (c) => c.domain.toLowerCase() === domain.toLowerCase()
      );

      if (!exists) {
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

        const client = {
          id: generateId(),
          name: domain,
          domain,
          industry: "",
          status: "active" as const,
          createdAt: new Date().toISOString(),
          gscSiteUrl: site.siteUrl,
          indicators,
        };

        addClient(client);
        newClients.push(client);
      }
    }

    return NextResponse.json({
      synced: newClients.length,
      total: getClients().length,
      clients: getClients(),
    });
  } catch (error) {
    console.error("GSC sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync GSC sites" },
      { status: 500 }
    );
  }
}
