import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { categoryWatchRepository } from "@/repositories/category-watch-repository";
import { clientRepository } from "@/repositories/client-repository";
import { getEnv, hasSerpApi } from "@/lib/env";
import { getSearchAnalytics, getGSCSites, matchDomainToGSCSite, getDateRange } from "@/lib/gsc-client";

const setupSchema = z.object({
  clientId: z.string().optional(),
  categoryName: z.string().min(1).max(100),
  targetUrl: z.string().url(),
});

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * STEP 1: Search the category name on Google (Serper) → top 5 SERP results
 */
async function fetchSerpData(query: string, apiKey: string) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "br",
      hl: "pt-br",
      location: "Brazil",
      num: 10,
    }),
  });

  if (!res.ok) throw new Error(`Serper error: ${res.status}`);

  const data = await res.json();
  const organic = (data.organic || []) as {
    position?: number;
    title?: string;
    link?: string;
    domain?: string;
    snippet?: string;
  }[];

  const top5 = organic.slice(0, 5).map((r, i) => ({
    position: r.position || i + 1,
    title: r.title || "",
    url: r.link || "",
    domain: r.domain || "",
    snippet: r.snippet || "",
  }));

  // Extract related queries
  const relatedSearches = (data.relatedSearches || []) as { query: string }[];
  const peopleAlsoAsk = (data.peopleAlsoAsk || []) as { question: string }[];

  const relatedQueries = [
    ...relatedSearches.map((rs) => rs.query),
    ...peopleAlsoAsk.map((paa) => paa.question),
  ];

  return { top5, relatedQueries };
}

/**
 * STEP 2: Check if client URL is in SERP results
 */
function findClientInSerp(
  serpResults: { position: number; url: string; domain: string }[],
  targetUrl: string
) {
  const targetDomain = extractDomain(targetUrl);
  const targetPath = targetUrl.replace(/\/$/, "").toLowerCase();

  // Exact URL match
  const exactMatch = serpResults.find(
    (r) => r.url.replace(/\/$/, "").toLowerCase() === targetPath
  );
  if (exactMatch) return { found: true, position: exactMatch.position, match: "exact" };

  // Domain match
  const domainMatch = serpResults.find(
    (r) => extractDomain(r.url) === targetDomain
  );
  if (domainMatch) return { found: true, position: domainMatch.position, match: "domain" };

  return { found: false, position: null, match: null };
}

/**
 * STEP 3: Get GSC position for exact query + exact URL (current and previous month)
 */
interface GSCPositionData {
  currentMonth: { position: number | null; clicks: number; impressions: number; ctr: number; period: string };
  previousMonth: { position: number | null; clicks: number; impressions: number; ctr: number; period: string };
  trend: "up" | "down" | "stable" | "new";
}

function getMonthRange(monthsAgo: number): { startDate: string; endDate: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 0); // last day of target month
  const start = new Date(end.getFullYear(), end.getMonth(), 1); // first day of target month

  // If current month, end = yesterday (GSC delay)
  if (monthsAgo === 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      endDate: yesterday.toISOString().split("T")[0],
    };
  }

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

type RawRow = {
  keys?: string[];
  position?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
};

function findQueryUrlMatch(rows: RawRow[], query: string, targetUrl: string) {
  const targetNorm = targetUrl.replace(/\/$/, "").toLowerCase();

  return rows.find((r) => {
    const rowQuery = (r.keys?.[0] || "").toLowerCase();
    const rowPage = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
    return rowQuery === query.toLowerCase() && (rowPage === targetNorm || rowPage.startsWith(targetNorm));
  });
}

async function getGSCPositionData(
  accessToken: string,
  gscSiteUrl: string,
  query: string,
  targetUrl: string
): Promise<GSCPositionData> {
  const currentRange = getMonthRange(0);
  const previousRange = getMonthRange(1);

  const [currentRows, previousRows] = await Promise.all([
    getSearchAnalytics(accessToken, gscSiteUrl, {
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      dimensions: ["query", "page"],
      rowLimit: 500,
    }),
    getSearchAnalytics(accessToken, gscSiteUrl, {
      startDate: previousRange.startDate,
      endDate: previousRange.endDate,
      dimensions: ["query", "page"],
      rowLimit: 500,
    }),
  ]);

  const currentMatch = findQueryUrlMatch(currentRows as RawRow[], query, targetUrl);
  const previousMatch = findQueryUrlMatch(previousRows as RawRow[], query, targetUrl);

  const currentPos = currentMatch?.position ? Number(currentMatch.position.toFixed(1)) : null;
  const previousPos = previousMatch?.position ? Number(previousMatch.position.toFixed(1)) : null;

  let trend: "up" | "down" | "stable" | "new" = "new";
  if (currentPos !== null && previousPos !== null) {
    const diff = previousPos - currentPos; // positive = improved (lower position = better)
    if (diff > 1) trend = "up";
    else if (diff < -1) trend = "down";
    else trend = "stable";
  } else if (currentPos !== null && previousPos === null) {
    trend = "new";
  }

  return {
    currentMonth: {
      position: currentPos,
      clicks: currentMatch?.clicks || 0,
      impressions: currentMatch?.impressions || 0,
      ctr: currentMatch?.ctr || 0,
      period: `${currentRange.startDate} a ${currentRange.endDate}`,
    },
    previousMonth: {
      position: previousPos,
      clicks: previousMatch?.clicks || 0,
      impressions: previousMatch?.impressions || 0,
      ctr: previousMatch?.ctr || 0,
      period: `${previousRange.startDate} a ${previousRange.endDate}`,
    },
    trend,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, categoryName, targetUrl } = parsed.data;
    const domain = extractDomain(targetUrl);

    // Find or create client
    let client = null;
    if (clientId) client = await clientRepository.findById(clientId);
    if (!client) client = await clientRepository.findByDomain(domain);
    if (!client) client = await clientRepository.upsertByDomain(domain, domain);

    // Check limit
    const count = await categoryWatchRepository.countByClient(client.id);
    if (count >= 5) {
      return NextResponse.json(
        { error: "Limite de 5 categorias por cliente atingido" },
        { status: 400 }
      );
    }

    // Create category watch
    const categoryWatch = await categoryWatchRepository.create(
      client.id,
      categoryName,
      targetUrl
    );

    // === STEP 1: Search on Google via Serper → top 5 + related ===
    let serpResults: { position: number; title: string; url: string; domain: string; snippet: string }[] = [];
    let relatedQueries: string[] = [];
    if (hasSerpApi()) {
      try {
        const env = getEnv();
        const serpData = await fetchSerpData(categoryName, env.SERP_API_KEY);
        serpResults = serpData.top5;
        relatedQueries = serpData.relatedQueries;
      } catch (e) {
        console.warn("[setup] Serper failed:", e);
      }
    }

    // === STEP 2: Check if client URL is in SERP ===
    const serpCheck = findClientInSerp(serpResults, targetUrl);

    // === STEP 3: Always get GSC position data (current + previous month) ===
    let gscData: GSCPositionData | null = null;
    try {
      const sites = await getGSCSites(session.accessToken);
      const gscSite = matchDomainToGSCSite(client.domain, sites);
      if (gscSite) {
        gscData = await getGSCPositionData(
          session.accessToken,
          gscSite,
          categoryName,
          targetUrl
        );
      }
    } catch (e) {
      console.warn("[setup] GSC data failed:", e);
    }

    const gscPosition = gscData?.currentMonth.position ?? null;

    // Build suggested queries: main query + related from Google
    const suggestedQueries = [
      {
        query: categoryName,
        impressions: gscData?.currentMonth.impressions ?? 0,
        position: serpCheck.found
          ? serpCheck.position!
          : gscPosition ?? 0,
        relevanceScore: 1.0,
        source: serpCheck.found
          ? `SERP Top ${serpCheck.position} (${serpCheck.match})`
          : gscPosition
            ? `GSC posição ${gscPosition}`
            : "Não encontrado na SERP nem no GSC",
      },
      ...relatedQueries.map((q, i) => ({
        query: q,
        impressions: 0,
        position: 0,
        relevanceScore: Math.max(0.3, 1.0 - (i + 1) * 0.07),
        source: "Google Related",
      })),
    ];

    return NextResponse.json({
      categoryWatch,
      suggestedQueries,
      serpResults,
      clientInSerp: serpCheck,
      gscPosition,
      gscData,
    });
  } catch (error) {
    console.error("[category-watch/setup] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
