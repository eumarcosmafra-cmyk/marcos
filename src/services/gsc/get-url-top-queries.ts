import { getSearchAnalytics, getDateRange } from "@/lib/gsc-client";

export interface UrlTopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  relevanceScore: number;
}

export async function getUrlTopQueries(
  accessToken: string,
  siteUrl: string,
  targetUrl: string,
  limit = 20
): Promise<UrlTopQuery[]> {
  const { startDate, endDate } = getDateRange("28d");

  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["query", "page"],
    rowLimit: 500,
  });

  type RawRow = {
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  };

  const urlNormalized = targetUrl.replace(/\/$/, "").toLowerCase();

  const filtered = (rows as RawRow[])
    .filter((r) => {
      const page = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
      return page === urlNormalized || page.startsWith(urlNormalized);
    })
    .map((r) => {
      const impressions = r.impressions || 0;
      const position = r.position || 50;
      const ctr = r.ctr || 0;

      // Relevance = impressions weighted by position proximity to top
      const relevanceScore =
        impressions * (1 / Math.max(position, 1)) * (1 + ctr);

      return {
        query: r.keys?.[0] || "",
        clicks: r.clicks || 0,
        impressions,
        ctr,
        position,
        relevanceScore: Number(relevanceScore.toFixed(2)),
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);

  return filtered;
}
