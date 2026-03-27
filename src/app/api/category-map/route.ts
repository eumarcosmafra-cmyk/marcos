import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap, filterCategoryUrls } from "@/lib/sitemap/parser";
import { enrichCategoriesWithGSC, generateMockCategories } from "@/lib/gsc/category-enrichment";
import { getGSCSites, matchDomainToGSCSite } from "@/lib/gsc-client";
import type { CategoryMapData } from "@/types/category-map";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { sitemapUrl, siteUrl, period = "28d", useMock = false } = body;

    // Mock mode for demonstration
    if (useMock || !sitemapUrl) {
      const categories = generateMockCategories();
      const totals = {
        total: categories.length,
        wellPositioned: categories.filter(c => c.status === "well_positioned").length,
        opportunity: categories.filter(c => c.status === "opportunity").length,
        critical: categories.filter(c => c.status === "critical").length,
        totalClicks: categories.reduce((s, c) => s + c.clicks, 0),
        totalImpressions: categories.reduce((s, c) => s + c.impressions, 0),
      };
      return NextResponse.json({
        categories,
        totals,
        siteUrl: "https://www.adove.com.br",
        analyzedAt: new Date().toISOString(),
      } satisfies CategoryMapData);
    }

    // Real mode: parse sitemap + enrich with GSC
    const allUrls = await parseSitemap(sitemapUrl);
    const categoryUrls = filterCategoryUrls(allUrls);

    if (categoryUrls.length === 0) {
      return NextResponse.json({
        error: "Nenhuma URL de categoria encontrada no sitemap",
      }, { status: 400 });
    }

    // Determine GSC site
    let gscSiteUrl = siteUrl;
    if (!gscSiteUrl) {
      const sites = await getGSCSites(session.accessToken);
      const domain = new URL(categoryUrls[0].loc).hostname.replace(/^www\./, "");
      const matched = matchDomainToGSCSite(domain, sites);
      if (!matched) {
        return NextResponse.json({ error: "Site não encontrado no GSC" }, { status: 400 });
      }
      gscSiteUrl = matched;
    }

    const categories = await enrichCategoriesWithGSC(
      session.accessToken,
      gscSiteUrl,
      categoryUrls,
      period
    );

    const totals = {
      total: categories.length,
      wellPositioned: categories.filter(c => c.status === "well_positioned").length,
      opportunity: categories.filter(c => c.status === "opportunity").length,
      critical: categories.filter(c => c.status === "critical").length,
      totalClicks: categories.reduce((s, c) => s + c.clicks, 0),
      totalImpressions: categories.reduce((s, c) => s + c.impressions, 0),
    };

    return NextResponse.json({
      categories,
      totals,
      siteUrl: gscSiteUrl,
      analyzedAt: new Date().toISOString(),
    } satisfies CategoryMapData);
  } catch (error) {
    console.error("[category-map] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
