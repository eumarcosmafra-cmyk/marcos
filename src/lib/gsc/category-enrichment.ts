import { getSearchAnalytics, getDateRange } from "@/lib/gsc-client";
import type { CategoryNode, SitemapUrl } from "@/types/category-map";
import { classifyCategory, calculatePriorityScore } from "@/lib/classification/category-classifier";
import { slugToName, analyzeUrlStructure } from "@/lib/sitemap/parser";

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

/**
 * Enrich category URLs with GSC data.
 * For each URL, find the top query (by clicks, then impressions, then position).
 */
export async function enrichCategoriesWithGSC(
  accessToken: string,
  siteUrl: string,
  categoryUrls: SitemapUrl[],
  period = "28d"
): Promise<CategoryNode[]> {
  const { startDate, endDate } = getDateRange(period);

  // Fetch all query+page data
  const rows = await getSearchAnalytics(accessToken, siteUrl, {
    startDate,
    endDate,
    dimensions: ["query", "page"],
    rowLimit: 5000,
  });

  const gscRows = rows as GscRow[];

  const categories: CategoryNode[] = [];

  for (const catUrl of categoryUrls) {
    const urlNorm = catUrl.loc.replace(/\/$/, "").toLowerCase();
    const { slug, depth, parentUrl } = analyzeUrlStructure(catUrl.loc);

    // Find all GSC rows matching this URL
    const matching = gscRows.filter((r) => {
      const page = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
      return page === urlNorm || page.startsWith(urlNorm);
    });

    if (matching.length === 0) {
      // No GSC data — mark as critical with zero metrics
      categories.push({
        id: `cat-${categories.length}`,
        url: catUrl.loc,
        slug,
        name: slugToName(slug),
        parentUrl,
        depth,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        topQuery: "(sem dados)",
        status: "critical",
        priorityScore: 0,
      });
      continue;
    }

    // Find top query: sort by clicks desc, then impressions desc, then position asc
    matching.sort((a, b) => {
      const clicksDiff = (b.clicks || 0) - (a.clicks || 0);
      if (clicksDiff !== 0) return clicksDiff;
      const impDiff = (b.impressions || 0) - (a.impressions || 0);
      if (impDiff !== 0) return impDiff;
      return (a.position || 100) - (b.position || 100);
    });

    const top = matching[0];
    const topQuery = top.keys?.[0] || "(desconhecido)";
    const clicks = top.clicks || 0;
    const impressions = top.impressions || 0;
    const ctr = top.ctr || 0;
    const position = top.position || 0;

    // Aggregate total clicks/impressions across all queries for this URL
    const totalClicks = matching.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpressions = matching.reduce((s, r) => s + (r.impressions || 0), 0);

    const status = classifyCategory(position, totalImpressions);
    const priorityScore = calculatePriorityScore(position, totalImpressions);

    categories.push({
      id: `cat-${categories.length}`,
      url: catUrl.loc,
      slug,
      name: slugToName(slug),
      parentUrl,
      depth,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: ctr > 1 ? ctr / 100 : ctr,
      position: Number(position.toFixed(1)),
      topQuery,
      status,
      priorityScore,
    });
  }

  // Sort by priority score descending
  categories.sort((a, b) => b.priorityScore - a.priorityScore);

  return categories;
}

/**
 * Generate mock data for demonstration purposes.
 */
export function generateMockCategories(): CategoryNode[] {
  const mockData: Omit<CategoryNode, "id" | "status" | "priorityScore">[] = [
    { url: "https://www.adove.com.br/solucao/", slug: "solucao", name: "Soluções", parentUrl: null, depth: 1, clicks: 245, impressions: 4200, ctr: 0.058, position: 3.2, topQuery: "soluções revops" },
    { url: "https://www.adove.com.br/solucao/automacoes-e-integracoes/", slug: "automacoes-e-integracoes", name: "Automações e Integrações", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 180, impressions: 3100, ctr: 0.058, position: 4.8, topQuery: "automação integração b2b" },
    { url: "https://www.adove.com.br/solucao/dados-e-bi/", slug: "dados-e-bi", name: "Dados e BI", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 89, impressions: 2800, ctr: 0.032, position: 8.4, topQuery: "business intelligence b2b" },
    { url: "https://www.adove.com.br/solucao/crm/", slug: "crm", name: "CRM", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 320, impressions: 5600, ctr: 0.057, position: 2.1, topQuery: "crm para empresas" },
    { url: "https://www.adove.com.br/solucao/revenue-operations/", slug: "revenue-operations", name: "Revenue Operations", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 156, impressions: 3900, ctr: 0.04, position: 6.7, topQuery: "revenue operations o que é" },
    { url: "https://www.adove.com.br/cases/", slug: "cases", name: "Cases", parentUrl: null, depth: 1, clicks: 42, impressions: 890, ctr: 0.047, position: 12.3, topQuery: "cases revops brasil" },
    { url: "https://www.adove.com.br/blog/", slug: "blog", name: "Blog", parentUrl: null, depth: 1, clicks: 520, impressions: 12000, ctr: 0.043, position: 7.9, topQuery: "blog revops" },
    { url: "https://www.adove.com.br/sobre/", slug: "sobre", name: "Sobre", parentUrl: null, depth: 1, clicks: 15, impressions: 320, ctr: 0.047, position: 18.5, topQuery: "adove comunicação" },
    { url: "https://www.adove.com.br/contato/", slug: "contato", name: "Contato", parentUrl: null, depth: 1, clicks: 28, impressions: 150, ctr: 0.187, position: 1.8, topQuery: "adove contato" },
    { url: "https://www.adove.com.br/solucao/marketing-ops/", slug: "marketing-ops", name: "Marketing Ops", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 67, impressions: 2100, ctr: 0.032, position: 11.2, topQuery: "marketing operations" },
    { url: "https://www.adove.com.br/solucao/sales-ops/", slug: "sales-ops", name: "Sales Ops", parentUrl: "https://www.adove.com.br/solucao/", depth: 2, clicks: 45, impressions: 1800, ctr: 0.025, position: 14.6, topQuery: "sales operations" },
    { url: "https://www.adove.com.br/parceiros/", slug: "parceiros", name: "Parceiros", parentUrl: null, depth: 1, clicks: 8, impressions: 95, ctr: 0.084, position: 25.3, topQuery: "parceiros hubspot brasil" },
  ];

  return mockData.map((d, i) => {
    const status = classifyCategory(d.position, d.impressions);
    const priorityScore = calculatePriorityScore(d.position, d.impressions);
    return { ...d, id: `cat-${i}`, status, priorityScore };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
