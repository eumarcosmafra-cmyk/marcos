import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap, filterCategoryUrls, slugToName, analyzeUrlStructure } from "@/lib/sitemap/parser";
import { enrichCategoriesWithGSC, generateMockCategories } from "@/lib/gsc/category-enrichment";
import { getGSCSites, matchDomainToGSCSite } from "@/lib/gsc-client";
import { classifyCategory, calculatePriorityScore } from "@/lib/classification/category-classifier";
import type { CategoryMapData, CategoryNode } from "@/types/category-map";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sitemapUrl, siteUrl, period = "28d", useMock = false } = body;

    // Mock mode — no auth needed
    if (useMock) {
      const categories = generateMockCategories();
      return NextResponse.json(buildResponse(categories, "https://www.adove.com.br"));
    }

    if (!sitemapUrl) {
      return NextResponse.json({ error: "Informe a URL do sitemap" }, { status: 400 });
    }

    // Parse sitemap
    let allUrls;
    try {
      allUrls = await parseSitemap(sitemapUrl);
    } catch (e) {
      return NextResponse.json({
        error: `Erro ao buscar sitemap: ${e instanceof Error ? e.message : "falha na requisição"}`,
      }, { status: 400 });
    }

    let categoryUrls = filterCategoryUrls(allUrls);

    // If filter removed everything, use all URLs
    if (categoryUrls.length === 0 && allUrls.length > 0) {
      categoryUrls = allUrls.slice(0, 100);
    }

    if (categoryUrls.length === 0) {
      return NextResponse.json({
        error: "Nenhuma URL encontrada no sitemap",
      }, { status: 400 });
    }

    // Try to enrich with GSC if authenticated
    const session = await auth().catch(() => null);

    if (session?.accessToken && siteUrl) {
      // Full mode: sitemap + GSC
      try {
        const categories = await enrichCategoriesWithGSC(
          session.accessToken,
          siteUrl,
          categoryUrls,
          period
        );
        return NextResponse.json(buildResponse(categories, siteUrl));
      } catch (e) {
        console.warn("[category-map] GSC enrichment failed, falling back to structure-only:", e);
      }
    } else if (session?.accessToken && !siteUrl) {
      // Try to auto-detect GSC site
      try {
        const sites = await getGSCSites(session.accessToken);
        const domain = new URL(categoryUrls[0].loc).hostname.replace(/^www\./, "");
        const matched = matchDomainToGSCSite(domain, sites);
        if (matched) {
          const categories = await enrichCategoriesWithGSC(
            session.accessToken,
            matched,
            categoryUrls,
            period
          );
          return NextResponse.json(buildResponse(categories, matched));
        }
      } catch (e) {
        console.warn("[category-map] GSC auto-detect failed:", e);
      }
    }

    // Structure-only mode: show categories from sitemap without GSC data
    const categories: CategoryNode[] = categoryUrls.map((u, i) => {
      const { slug, depth, parentUrl } = analyzeUrlStructure(u.loc);
      return {
        id: `cat-${i}`,
        url: u.loc,
        slug,
        name: slugToName(slug),
        parentUrl,
        depth,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQuery: "(conecte o GSC para ver queries)",
        status: "critical" as const,
        priorityScore: 0,
      };
    });

    return NextResponse.json(buildResponse(categories, sitemapUrl));
  } catch (error) {
    console.error("[category-map] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function buildResponse(categories: CategoryNode[], siteUrl: string): CategoryMapData {
  return {
    categories,
    totals: {
      total: categories.length,
      wellPositioned: categories.filter(c => c.status === "well_positioned").length,
      opportunity: categories.filter(c => c.status === "opportunity").length,
      critical: categories.filter(c => c.status === "critical").length,
      totalClicks: categories.reduce((s, c) => s + c.clicks, 0),
      totalImpressions: categories.reduce((s, c) => s + c.impressions, 0),
    },
    siteUrl,
    analyzedAt: new Date().toISOString(),
  };
}
