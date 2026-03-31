import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap } from "@/lib/sitemap/parser";
import { getSearchAnalytics, getGSCSites, matchDomainToGSCSite, getDateRange } from "@/lib/gsc-client";
import type { SitemapUrl } from "@/types/category-map";

// ============================================================
// Types
// ============================================================

interface BlogUrl {
  url: string;
  title: string;
  totalImpressions: number;
  totalClicks: number;
  avgPosition: number;
  topQueries: { query: string; impressions: number; position: number }[];
}

// ============================================================
// Deterministic clustering by query keywords (no AI)
// ============================================================

const STOPWORDS_PT = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "um", "uma",
  "para", "com", "por", "que", "se", "na", "no", "nas", "nos", "ao", "aos",
  "como", "mais", "mas", "seu", "sua", "seus", "suas", "este", "esta", "isso",
  "qual", "quando", "onde", "porque", "entre", "sobre", "após", "até",
  "ter", "ser", "fazer", "pode", "tem", "vai", "vem", "dia", "ano",
]);

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS_PT.has(w));
}

function clusterName(keywords: string[]): string {
  return keywords
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function groupIntoClusters(urls: BlogUrl[]) {
  const clusters = new Map<string, BlogUrl[]>();

  for (const url of urls) {
    const topQuery = url.topQueries[0]?.query || "";
    const keywords = extractKeywords(topQuery);

    if (keywords.length === 0) {
      const name = "Outros";
      if (!clusters.has(name)) clusters.set(name, []);
      clusters.get(name)!.push(url);
      continue;
    }

    // Find existing cluster with >= 2 matching keywords
    let matched = false;
    for (const [clusterKey, members] of clusters) {
      const clusterKeywords = extractKeywords(
        members[0]?.topQueries[0]?.query || clusterKey
      );
      const overlap = keywords.filter((k) => clusterKeywords.includes(k));
      if (overlap.length >= 2) {
        members.push(url);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const name = clusterName(keywords) || "Outros";
      if (!clusters.has(name)) clusters.set(name, []);
      clusters.get(name)!.push(url);
    }
  }

  return Array.from(clusters.entries())
    .map(([name, members]) => ({
      name,
      urls: members,
      totalImpressions: members.reduce((s, u) => s + u.totalImpressions, 0),
      totalClicks: members.reduce((s, u) => s + u.totalClicks, 0),
      avgPosition:
        members.length > 0
          ? members.reduce((s, u) => s + (u.avgPosition || 0), 0) / members.length
          : 0,
      topUrl: members.sort((a, b) => b.totalImpressions - a.totalImpressions)[0],
    }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions);
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, period = "3m", topN = 100, sitemapUrl, step } = body;

    // ---- STEP 1: SCAN (GSC-first) ----
    if (step === "scan" || !step) {
      const session = await auth().catch(() => null);
      if (!session?.accessToken) {
        return NextResponse.json(
          { error: "Conecte o Google Search Console primeiro" },
          { status: 401 }
        );
      }

      let gscSiteUrl = siteUrl;
      if (!gscSiteUrl) {
        const sites = await getGSCSites(session.accessToken);
        if (sites.length > 0) gscSiteUrl = sites[0].siteUrl;
      }
      if (!gscSiteUrl) {
        return NextResponse.json(
          { error: "Nenhum site encontrado no GSC" },
          { status: 400 }
        );
      }

      const { startDate, endDate } = getDateRange(period);

      const rows = (await getSearchAnalytics(session.accessToken, gscSiteUrl, {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 25000,
      })) as {
        keys?: string[];
        clicks?: number;
        impressions?: number;
        ctr?: number;
        position?: number;
      }[];

      // Filter to blog URLs
      const blogRows = rows.filter((r) => {
        const page = r.keys?.[1] || "";
        return (
          page.includes("/blog/") ||
          page.includes("/artigo/") ||
          page.includes("/post/")
        );
      });

      // Aggregate by page
      const pageMap = new Map<string, BlogUrl>();
      for (const r of blogRows) {
        const page = r.keys?.[1] || "";
        const query = r.keys?.[0] || "";
        if (!pageMap.has(page)) {
          const slug = page.split("/").filter(Boolean).pop() || "";
          pageMap.set(page, {
            url: page,
            title: slug
              .replace(/[-_]/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            totalImpressions: 0,
            totalClicks: 0,
            avgPosition: 0,
            topQueries: [],
          });
        }
        const entry = pageMap.get(page)!;
        entry.totalImpressions += r.impressions || 0;
        entry.totalClicks += r.clicks || 0;
        entry.topQueries.push({
          query,
          impressions: r.impressions || 0,
          position: r.position || 0,
        });
      }

      // Calculate avg position per page
      for (const entry of pageMap.values()) {
        entry.topQueries.sort((a, b) => b.impressions - a.impressions);
        if (entry.topQueries.length > 0) {
          entry.avgPosition = entry.topQueries[0].position;
        }
        entry.topQueries = entry.topQueries.slice(0, 5);
      }

      // Sort by impressions, take top N
      const allBlogUrls = Array.from(pageMap.values()).sort(
        (a, b) => b.totalImpressions - a.totalImpressions
      );
      const topUrls = allBlogUrls.slice(0, Math.min(topN, 200));

      // Gap detection (if sitemap provided)
      const gaps = {
        zeroVisibility: [] as string[],
        sitemapOrphans: [] as string[],
      };
      if (sitemapUrl) {
        try {
          const sitemapUrls = await parseSitemap(sitemapUrl);
          const sitemapBlogUrls = sitemapUrls
            .map((u: SitemapUrl) => u.loc)
            .filter(
              (url: string) =>
                url.includes("/blog/") ||
                url.includes("/artigo/") ||
                url.includes("/post/")
            );

          const gscUrlSet = new Set(
            allBlogUrls.map((u) => u.url.replace(/\/$/, "").toLowerCase())
          );
          const sitemapUrlSet = new Set(
            sitemapBlogUrls.map((u: string) =>
              u.replace(/\/$/, "").toLowerCase()
            )
          );

          gaps.zeroVisibility = [...sitemapUrlSet].filter(
            (u) => !gscUrlSet.has(u)
          );
          gaps.sitemapOrphans = [...gscUrlSet].filter(
            (u) => !sitemapUrlSet.has(u)
          );
        } catch (e) {
          console.error("[content-intelligence] Sitemap gap detection failed:", e);
        }
      }

      return NextResponse.json({
        step: "scan_complete",
        totalUrls: allBlogUrls.length,
        analyzingUrls: topUrls.length,
        urls: topUrls,
        gaps,
      });
    }

    // ---- STEP 2: CLUSTER (deterministic, no AI) ----
    if (step === "cluster") {
      const { urls } = body as { urls: BlogUrl[] };

      const clusters = groupIntoClusters(urls);

      const result = {
        clusters: clusters.map((c) => ({
          nome_cluster: c.name,
          total_urls: c.urls.length,
          gsc_impressions: c.totalImpressions,
          gsc_clicks: c.totalClicks,
          avg_position: Math.round(c.avgPosition * 10) / 10,
          ctr:
            c.totalImpressions > 0
              ? Math.round((c.totalClicks / c.totalImpressions) * 1000) / 10
              : 0,
          top_url: c.topUrl?.url || "",
          top_query: c.topUrl?.topQueries[0]?.query || "",
          urls: c.urls.map((u) => ({
            url: u.url,
            title: u.title,
            impressions: u.totalImpressions,
            clicks: u.totalClicks,
            position: u.avgPosition,
            top_query: u.topQueries[0]?.query || "",
          })),
          score:
            c.totalImpressions > 1000
              ? "strong"
              : c.totalImpressions > 100
                ? "medium"
                : "weak",
        })),
        resumo: {
          total_urls: urls.length,
          total_clusters: clusters.length,
          total_impressions: urls.reduce((s, u) => s + u.totalImpressions, 0),
          total_clicks: urls.reduce((s, u) => s + u.totalClicks, 0),
        },
        gaps: body.gaps || { zeroVisibility: [], sitemapOrphans: [] },
      };

      return NextResponse.json({ step: "complete", analysis: result });
    }

    /* AI_DISABLED — analyze_batch and merge steps
     * These steps use Gemini AI for semantic clustering.
     * Temporarily disabled due to API cost and instability.
     * To re-enable: uncomment and remove the "cluster" step above.
     *
     * step: "analyze_batch" → calls callGemini for classification
     * step: "merge" → calls callGemini for final diagnosis
     */

    return NextResponse.json({ error: "Step inválido" }, { status: 400 });
  } catch (error) {
    console.error("[content-intelligence] Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY não configurada. Adicione a chave nas variáveis de ambiente do Vercel.",
        },
        { status: 400 }
      );
    }
    if (message.includes("HTTP 429")) {
      return NextResponse.json(
        {
          error:
            "Limite de requisições atingido. Aguarde 1 minuto e tente novamente.",
        },
        { status: 400 }
      );
    }
    if (message.includes("HTTP 401") || message.includes("HTTP 403")) {
      return NextResponse.json(
        {
          error:
            "Erro de autenticação com a API Gemini. Verifique sua chave.",
        },
        { status: 400 }
      );
    }
    if (message.includes("HTTP 4")) {
      return NextResponse.json(
        { error: "Erro na API Gemini: " + message },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
