import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { categoryWatchRepository } from "@/repositories/category-watch-repository";
import { clientRepository } from "@/repositories/client-repository";
import { getGSCSites, matchDomainToGSCSite, getSearchAnalytics } from "@/lib/gsc-client";
import { hasSerpApi, getEnv } from "@/lib/env";

type Params = { params: Promise<{ id: string }> };

function getMonthRange(monthsAgo: number) {
  const now = new Date();
  if (monthsAgo === 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      endDate: yesterday.toISOString().split("T")[0],
    };
  }
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 0);
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export async function GET(request: NextRequest, context: Params) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: clientId } = await context.params;
    const client = await clientRepository.findById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const categories = await categoryWatchRepository.findByClient(clientId);

    // Get GSC site
    const sites = await getGSCSites(session.accessToken);
    const gscSite = matchDomainToGSCSite(client.domain, sites);

    const currentRange = getMonthRange(0);
    const previousRange = getMonthRange(1);

    // Fetch GSC data for both months
    let currentRows: any[] = [];
    let previousRows: any[] = [];
    if (gscSite) {
      const [cr, pr] = await Promise.all([
        getSearchAnalytics(session.accessToken, gscSite, {
          startDate: currentRange.startDate,
          endDate: currentRange.endDate,
          dimensions: ["query", "page"],
          rowLimit: 500,
        }),
        getSearchAnalytics(session.accessToken, gscSite, {
          startDate: previousRange.startDate,
          endDate: previousRange.endDate,
          dimensions: ["query", "page"],
          rowLimit: 500,
        }),
      ]);
      currentRows = Array.isArray(cr) ? cr : [];
      previousRows = Array.isArray(pr) ? pr : [];
    }

    // For each category, get primary query position + SERP
    const env = getEnv();
    const rankings = [];

    for (const cat of categories) {
      const primaryQuery = cat.trackedQueries.find((q: any) => q.isPrimary);
      if (!primaryQuery) {
        rankings.push({
          id: cat.id,
          name: cat.name,
          targetUrl: cat.targetUrl,
          query: null,
          gscCurrent: null,
          gscPrevious: null,
          trend: null,
          serpTop5: [],
        });
        continue;
      }

      const query = primaryQuery.query;
      const targetNorm = cat.targetUrl.replace(/\/$/, "").toLowerCase();

      // Find GSC match for current month
      const currentMatch = (currentRows as any[]).find((r: any) => {
        const rq = (r.keys?.[0] || "").toLowerCase();
        const rp = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
        return rq === query.toLowerCase() && (rp === targetNorm || rp.startsWith(targetNorm));
      });

      const previousMatch = (previousRows as any[]).find((r: any) => {
        const rq = (r.keys?.[0] || "").toLowerCase();
        const rp = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
        return rq === query.toLowerCase() && (rp === targetNorm || rp.startsWith(targetNorm));
      });

      const currentPos = currentMatch?.position ? Number(currentMatch.position.toFixed(1)) : null;
      const previousPos = previousMatch?.position ? Number(previousMatch.position.toFixed(1)) : null;

      let trend: "up" | "down" | "stable" | "new" | null = null;
      if (currentPos !== null && previousPos !== null) {
        const diff = previousPos - currentPos;
        if (diff > 1) trend = "up";
        else if (diff < -1) trend = "down";
        else trend = "stable";
      } else if (currentPos !== null) {
        trend = "new";
      }

      // Fetch SERP top 5
      let serpTop5: { position: number; title: string; url: string; domain: string }[] = [];
      if (hasSerpApi() && env.SERP_API_KEY) {
        try {
          const res = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: { "X-API-KEY": env.SERP_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ q: query, gl: "br", hl: "pt-br", location: "Brazil", num: 5 }),
          });
          if (res.ok) {
            const data = await res.json();
            serpTop5 = (data.organic || []).slice(0, 5).map((r: any, i: number) => ({
              position: r.position || i + 1,
              title: r.title || "",
              url: r.link || "",
              domain: r.domain || "",
            }));
          }
        } catch {}
      }

      rankings.push({
        id: cat.id,
        name: cat.name,
        targetUrl: cat.targetUrl,
        query,
        gscCurrent: currentPos,
        gscPrevious: previousPos,
        gscClicks: currentMatch?.clicks || 0,
        gscImpressions: currentMatch?.impressions || 0,
        trend,
        serpTop5,
      });
    }

    return NextResponse.json({ rankings });
  } catch (error) {
    console.error("[client/rankings] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
