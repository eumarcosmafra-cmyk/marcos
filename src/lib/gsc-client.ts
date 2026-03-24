import { google } from "googleapis";
import { getCached, setCache } from "./gsc-cache";
import type {
  GSCSite,
  GSCQueryRow,
  GSCPageRow,
  GSCDateRow,
  GSCOverviewData,
  GSCQueryPageRow,
  Opportunity,
  PositionBand,
} from "@/types/gsc";

function getAuth(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}

export async function getGSCSites(accessToken: string): Promise<GSCSite[]> {
  const cacheKey = "gsc:sites";
  const cached = getCached<GSCSite[]>(cacheKey);
  if (cached) return cached;

  const auth = getAuth(accessToken);
  const webmasters = google.webmasters({ version: "v3", auth });
  const res = await webmasters.sites.list();

  const sites: GSCSite[] = (res.data.siteEntry || []).map((s) => ({
    siteUrl: s.siteUrl || "",
    permissionLevel: s.permissionLevel || "unknown",
  }));

  setCache(cacheKey, sites);
  return sites;
}

export async function getSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  options: {
    startDate: string;
    endDate: string;
    dimensions: string[];
    rowLimit?: number;
  }
) {
  const cacheKey = `gsc:analytics:${siteUrl}:${options.dimensions.join(",")}:${options.startDate}:${options.endDate}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const auth = getAuth(accessToken);
  const webmasters = google.webmasters({ version: "v3", auth });

  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions,
      rowLimit: options.rowLimit || 25,
    },
  });

  const rows = res.data.rows || [];
  setCache(cacheKey, rows);
  return rows;
}

export async function getTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit = 20
): Promise<GSCQueryRow[]> {
  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: limit,
  });

  return (rows as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]).map((r) => ({
    query: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export async function getTopPages(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit = 20
): Promise<GSCPageRow[]> {
  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: limit,
  });

  return (rows as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]).map((r) => ({
    page: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export async function getDailyData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCDateRow[]> {
  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["date"],
    rowLimit: 500,
  });

  return (rows as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]).map((r) => ({
    date: r.keys?.[0] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export async function getSiteOverview(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCOverviewData> {
  const [topQueries, topPages, dailyData] = await Promise.all([
    getTopQueries(accessToken, siteUrl, startDate, endDate),
    getTopPages(accessToken, siteUrl, startDate, endDate),
    getDailyData(accessToken, siteUrl, startDate, endDate),
  ]);

  const totalClicks = dailyData.reduce((s, d) => s + d.clicks, 0);
  const totalImpressions = dailyData.reduce((s, d) => s + d.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition =
    dailyData.length > 0
      ? dailyData.reduce((s, d) => s + d.position, 0) / dailyData.length
      : 0;

  return {
    totalClicks,
    totalImpressions,
    avgCtr,
    avgPosition,
    topQueries,
    topPages,
    dailyData,
  };
}

export async function getQueryPageData(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  limit = 500
): Promise<GSCQueryPageRow[]> {
  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["query", "page"],
    rowLimit: limit,
  });

  return (rows as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]).map((r) => ({
    query: r.keys?.[0] || "",
    page: r.keys?.[1] || "",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
}

export function findQuickWins(rows: GSCQueryPageRow[]): Opportunity[] {
  if (!rows.length) return [];

  const validRows = rows.filter(
    (r) => r.query && r.page && r.impressions > 0 && r.position > 0
  );
  if (!validRows.length) return [];

  const impressionThreshold = Math.max(
    20,
    percentile(validRows.map((r) => r.impressions), 70)
  );

  return validRows
    .map((r) => ({
      ...r,
      ctr: normalizeCtr(r.ctr),
    }))
    .filter((r) => {
      return (
        r.impressions >= impressionThreshold &&
        r.position >= 5 &&
        r.position <= 30 &&
        r.ctr < 0.05
      );
    })
    .map((r) => {
      const score =
        r.impressions *
        (1 / Math.max(r.position, 1)) *
        (1 - r.ctr);

      const pos = Number(r.position.toFixed(1));
      return {
        query: r.query,
        url: r.page,
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: Number((r.ctr * 100).toFixed(2)),
        position: pos,
        score: Number(score.toFixed(2)),
        reason: `Impressões acima do corte (${impressionThreshold}) + posição entre 5 e 30 + CTR baixo`,
        band: getBand(r.position),
        nextMove: getNextMove(r.position),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function getBand(position: number): PositionBand {
  if (position <= 1.5) return "Top 1";
  if (position <= 3.5) return "Top 3";
  if (position <= 10) return "Top 10";
  if (position <= 20) return "Top 20";
  return "Top 30";
}

function getNextMove(position: number): string {
  if (position <= 3.5) return "Defender posição";
  if (position <= 10) return "Buscar Top 3";
  if (position <= 20) return "Buscar Top 10";
  return "Ganhar visibilidade";
}

function normalizeCtr(ctr: number): number {
  return ctr > 1 ? ctr / 100 : ctr;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length)
  );
  return sorted[index];
}

/**
 * Match a client domain (e.g. "fashionstore.com.br") to a GSC site URL.
 * GSC sites can be:
 *   - Domain property: "sc-domain:fashionstore.com.br"
 *   - URL prefix: "https://fashionstore.com.br/" or "http://www.fashionstore.com.br/"
 */
export function matchDomainToGSCSite(
  domain: string,
  sites: GSCSite[]
): string | null {
  const clean = domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");

  // Try domain property first
  const domainMatch = sites.find(
    (s) => s.siteUrl === `sc-domain:${clean}`
  );
  if (domainMatch) return domainMatch.siteUrl;

  // Try URL prefix variations
  const prefixes = [
    `https://${clean}/`,
    `https://www.${clean}/`,
    `http://${clean}/`,
    `http://www.${clean}/`,
  ];

  for (const prefix of prefixes) {
    const match = sites.find((s) => s.siteUrl === prefix);
    if (match) return match.siteUrl;
  }

  // Partial match as fallback
  const partial = sites.find((s) =>
    s.siteUrl.toLowerCase().includes(clean.toLowerCase())
  );
  return partial?.siteUrl || null;
}

export function getDateRange(period: string): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1); // GSC data has ~2 day delay
  const start = new Date(end);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "28d":
      start.setDate(start.getDate() - 28);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "12m":
      start.setMonth(start.getMonth() - 12);
      break;
    case "16m":
      start.setMonth(start.getMonth() - 16);
      break;
    default:
      start.setDate(start.getDate() - 28);
  }

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}
