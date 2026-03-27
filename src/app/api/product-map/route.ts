import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap, filterProductUrls, slugToName, analyzeUrlStructure } from "@/lib/sitemap/parser";
import { enrichCategoriesWithGSC, generateMockProducts } from "@/lib/gsc/category-enrichment";
import { getGSCSites, matchDomainToGSCSite } from "@/lib/gsc-client";
import type { CategoryMapData, CategoryNode } from "@/types/category-map";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sitemapUrl, siteUrl, period = "3m", useMock = false } = body;

    if (useMock) {
      const categories = generateMockProducts();
      return NextResponse.json(buildResponse(categories, "https://www.useepulari.com.br"));
    }

    if (!sitemapUrl) {
      return NextResponse.json({ error: "Informe a URL do sitemap" }, { status: 400 });
    }

    let allUrls;
    try {
      allUrls = await parseSitemap(sitemapUrl);
    } catch (e) {
      return NextResponse.json({
        error: `Erro ao buscar sitemap: ${e instanceof Error ? e.message : "falha na requisição"}`,
      }, { status: 400 });
    }

    let productUrls = filterProductUrls(allUrls);

    if (productUrls.length === 0 && allUrls.length > 0) {
      productUrls = allUrls.filter(u => {
        try {
          const segments = new URL(u.loc).pathname.split("/").filter(Boolean);
          return segments.length >= 2;
        } catch { return false; }
      }).slice(0, 200);
    }

    if (productUrls.length === 0) {
      return NextResponse.json({ error: "Nenhuma URL de produto encontrada no sitemap" }, { status: 400 });
    }

    const session = await auth().catch(() => null);

    if (session?.accessToken && siteUrl) {
      try {
        const categories = await enrichCategoriesWithGSC(session.accessToken, siteUrl, productUrls, period);
        return NextResponse.json(buildResponse(categories, siteUrl));
      } catch (e) {
        console.warn("[product-map] GSC enrichment failed:", e);
      }
    } else if (session?.accessToken && !siteUrl) {
      try {
        const sites = await getGSCSites(session.accessToken);
        const domain = new URL(productUrls[0].loc).hostname.replace(/^www\./, "");
        const matched = matchDomainToGSCSite(domain, sites);
        if (matched) {
          const categories = await enrichCategoriesWithGSC(session.accessToken, matched, productUrls, period);
          return NextResponse.json(buildResponse(categories, matched));
        }
      } catch (e) {
        console.warn("[product-map] GSC auto-detect failed:", e);
      }
    }

    const categories: CategoryNode[] = productUrls.map((u, i) => {
      const { slug, depth, parentUrl } = analyzeUrlStructure(u.loc);
      return {
        id: `prod-${i}`, url: u.loc, slug, name: slugToName(slug), parentUrl, depth,
        clicks: 0, impressions: 0, ctr: 0, position: 0,
        topQuery: "(conecte o GSC para ver queries)", status: "critical" as const, priorityScore: 0,
      };
    });

    return NextResponse.json(buildResponse(categories, sitemapUrl));
  } catch (error) {
    console.error("[product-map] Error:", error);
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
