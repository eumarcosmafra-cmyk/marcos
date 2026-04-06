import { google } from "googleapis";
import { getCached, setCache } from "./gsc-cache";

function getAuth(accessToken: string) {
  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}

export interface GA4PeriodData {
  revenue: number;
  transactions: number;
  itemsViewed: number;
  addedToCart: number;
  itemsPurchased: number;
  sessions: number;
  users: number;
}

export interface GA4DateRange {
  startDate: string;
  endDate: string;
}

export async function getGA4EcommerceData(
  accessToken: string,
  propertyId: string,
  dateRange: GA4DateRange
): Promise<GA4PeriodData> {
  const cacheKey = `ga4:ecommerce:${propertyId}:${dateRange.startDate}:${dateRange.endDate}`;
  const cached = getCached<GA4PeriodData>(cacheKey);
  if (cached) return cached;

  const auth = getAuth(accessToken);
  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const response = await analyticsdata.properties.runReport({
    property: propertyId,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      metrics: [
        { name: "purchaseRevenue" },
        { name: "transactions" },
        { name: "itemsViewed" },
        { name: "addToCarts" },
        { name: "itemsPurchased" },
        { name: "sessions" },
        { name: "totalUsers" },
      ],
    },
  });

  const row = response.data.rows?.[0]?.metricValues || [];

  const result: GA4PeriodData = {
    revenue: parseFloat(row[0]?.value || "0"),
    transactions: parseInt(row[1]?.value || "0"),
    itemsViewed: parseInt(row[2]?.value || "0"),
    addedToCart: parseInt(row[3]?.value || "0"),
    itemsPurchased: parseInt(row[4]?.value || "0"),
    sessions: parseInt(row[5]?.value || "0"),
    users: parseInt(row[6]?.value || "0"),
  };

  setCache(cacheKey, result);
  return result;
}

export async function getGA4Comparison(
  accessToken: string,
  propertyId: string,
  currentPeriod: GA4DateRange,
  previousPeriod: GA4DateRange
): Promise<{
  current: GA4PeriodData;
  previous: GA4PeriodData;
  deltas: { revenue: number; transactions: number; sessions: number; users: number };
}> {
  const [current, previous] = await Promise.all([
    getGA4EcommerceData(accessToken, propertyId, currentPeriod),
    getGA4EcommerceData(accessToken, propertyId, previousPeriod),
  ]);

  const delta = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;

  return {
    current,
    previous,
    deltas: {
      revenue: delta(current.revenue, previous.revenue),
      transactions: delta(current.transactions, previous.transactions),
      sessions: delta(current.sessions, previous.sessions),
      users: delta(current.users, previous.users),
    },
  };
}

export async function validateGA4Property(
  accessToken: string,
  propertyId: string
): Promise<{ valid: boolean; name?: string; error?: string }> {
  try {
    const auth = getAuth(accessToken);
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
    await analyticsdata.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: [{ name: "sessions" }],
      },
    });
    return { valid: true, name: propertyId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("403")) return { valid: false, error: "Sem permissão para acessar esta propriedade GA4." };
    if (message.includes("404")) return { valid: false, error: "Propriedade GA4 não encontrada." };
    return { valid: false, error: "Erro ao validar propriedade GA4." };
  }
}
