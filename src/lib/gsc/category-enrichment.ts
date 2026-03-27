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
/**
 * Extract brand names from a GSC site URL or domain.
 * Returns multiple variations to catch branded queries.
 * e.g. "sc-domain:useepulari.com.br" → ["useepulari", "epulari"]
 *      "https://www.adove.com.br/" → ["adove"]
 */
function extractBrandNames(siteUrl: string): string[] {
  const domain = siteUrl
    .replace("sc-domain:", "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
  const baseName = domain.split(".")[0].toLowerCase();

  const names = [baseName];

  // Common prefixes to strip: use, loja, site, www, shop, store
  const prefixes = ["use", "loja", "site", "shop", "store", "meu", "my"];
  for (const prefix of prefixes) {
    if (baseName.startsWith(prefix) && baseName.length > prefix.length + 2) {
      names.push(baseName.slice(prefix.length));
    }
  }

  return names;
}

/**
 * Check if a query is branded (contains any brand name variation).
 */
function isBrandedQuery(query: string, brandNames: string[]): boolean {
  const lower = query.toLowerCase().trim();
  return brandNames.some((brand) => {
    // Exact match (query IS the brand name)
    if (lower === brand) return true;
    // Query starts with brand name
    if (lower.startsWith(brand + " ")) return true;
    // Query contains brand name as a word
    if (lower.includes(" " + brand + " ") || lower.includes(" " + brand)) return true;
    return false;
  });
}

/**
 * Check if a URL is a homepage or special brand page (not a category).
 */
function isHomepageOrSpecial(url: string): boolean {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path === "" || path === "/" || path === "/home";
  } catch {
    return false;
  }
}

export async function enrichCategoriesWithGSC(
  accessToken: string,
  siteUrl: string,
  categoryUrls: SitemapUrl[],
  period = "3m"
): Promise<CategoryNode[]> {
  const { startDate, endDate } = getDateRange(period);
  const brandNames = extractBrandNames(siteUrl);

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
    const isHome = isHomepageOrSpecial(catUrl.loc);

    // Find all GSC rows matching this EXACT URL (no startsWith to avoid parent stealing child data)
    const matching = gscRows.filter((r) => {
      const page = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
      return page === urlNorm;
    });

    if (matching.length === 0) {
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

    // Sort by clicks desc, then impressions desc, then position asc
    matching.sort((a, b) => {
      const clicksDiff = (b.clicks || 0) - (a.clicks || 0);
      if (clicksDiff !== 0) return clicksDiff;
      const impDiff = (b.impressions || 0) - (a.impressions || 0);
      if (impDiff !== 0) return impDiff;
      return (a.position || 100) - (b.position || 100);
    });

    // For category pages: skip branded queries, use generic category query
    // For homepage: branded queries are OK
    let topRow = matching[0];
    if (!isHome && brandNames.length > 0) {
      const nonBranded = matching.filter((r) => !isBrandedQuery(r.keys?.[0] || "", brandNames));
      if (nonBranded.length > 0) {
        topRow = nonBranded[0];
      }
    }

    const topQuery = topRow.keys?.[0] || "(desconhecido)";
    const position = topRow.position || 0;
    const ctr = topRow.ctr || 0;

    // Aggregate total clicks/impressions across ALL queries for this URL (not just top)
    const totalClicks = matching.reduce((s, r) => s + (r.clicks || 0), 0);
    const totalImpressions = matching.reduce((s, r) => s + (r.impressions || 0), 0);

    // Use position from the top non-branded query for classification
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
    { url: "https://www.adove.com.br/sobre/", slug: "sobre", name: "Sobre", parentUrl: null, depth: 1, clicks: 15, impressions: 320, ctr: 0.047, position: 18.5, topQuery: "consultoria revops" },
    { url: "https://www.adove.com.br/contato/", slug: "contato", name: "Contato", parentUrl: null, depth: 1, clicks: 28, impressions: 150, ctr: 0.187, position: 1.8, topQuery: "contato revops consultoria" },
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

/**
 * Generate mock product data for demonstration purposes.
 */
export function generateMockProducts(): CategoryNode[] {
  const mockData: Omit<CategoryNode, "id" | "status" | "priorityScore">[] = [
    { url: "https://www.useepulari.com.br/feminino/saia-calca/saia-calca-fitness", slug: "saia-calca-fitness", name: "Saia Calça Fitness", parentUrl: "https://www.useepulari.com.br/feminino/saia-calca/", depth: 3, clicks: 89, impressions: 3200, ctr: 0.028, position: 4.2, topQuery: "saia calça fitness" },
    { url: "https://www.useepulari.com.br/feminino/moda-praia/biquini-evangelico", slug: "biquini-evangelico", name: "Biquíni Evangélico", parentUrl: "https://www.useepulari.com.br/feminino/moda-praia/", depth: 3, clicks: 156, impressions: 5800, ctr: 0.027, position: 3.1, topQuery: "biquíni evangélico" },
    { url: "https://www.useepulari.com.br/feminino/esportes/legging-academia", slug: "legging-academia", name: "Legging Academia", parentUrl: "https://www.useepulari.com.br/feminino/esportes/", depth: 3, clicks: 210, impressions: 8900, ctr: 0.024, position: 6.8, topQuery: "legging academia feminina" },
    { url: "https://www.useepulari.com.br/feminino/vestidos/vestido-midi", slug: "vestido-midi", name: "Vestido Midi", parentUrl: "https://www.useepulari.com.br/feminino/vestidos/", depth: 3, clicks: 340, impressions: 12000, ctr: 0.028, position: 2.5, topQuery: "vestido midi" },
    { url: "https://www.useepulari.com.br/feminino/saia-calca/saia-calca-jeans", slug: "saia-calca-jeans", name: "Saia Calça Jeans", parentUrl: "https://www.useepulari.com.br/feminino/saia-calca/", depth: 3, clicks: 45, impressions: 2100, ctr: 0.021, position: 8.9, topQuery: "saia calça jeans" },
    { url: "https://www.useepulari.com.br/feminino/moda-praia/saida-praia", slug: "saida-praia", name: "Saída de Praia", parentUrl: "https://www.useepulari.com.br/feminino/moda-praia/", depth: 3, clicks: 78, impressions: 4500, ctr: 0.017, position: 11.3, topQuery: "saída de praia" },
    { url: "https://www.useepulari.com.br/feminino/esportes/short-academia", slug: "short-academia", name: "Short Academia", parentUrl: "https://www.useepulari.com.br/feminino/esportes/", depth: 3, clicks: 120, impressions: 6200, ctr: 0.019, position: 7.4, topQuery: "short academia feminino" },
    { url: "https://www.useepulari.com.br/feminino/conjuntos/conjunto-fitness", slug: "conjunto-fitness", name: "Conjunto Fitness", parentUrl: "https://www.useepulari.com.br/feminino/conjuntos/", depth: 3, clicks: 95, impressions: 3800, ctr: 0.025, position: 5.6, topQuery: "conjunto fitness feminino" },
    { url: "https://www.useepulari.com.br/feminino/moda-praia/maio-evangelico", slug: "maio-evangelico", name: "Maiô Evangélico", parentUrl: "https://www.useepulari.com.br/feminino/moda-praia/", depth: 3, clicks: 67, impressions: 2900, ctr: 0.023, position: 9.2, topQuery: "maiô evangélico" },
    { url: "https://www.useepulari.com.br/feminino/vestidos/vestido-longo", slug: "vestido-longo", name: "Vestido Longo", parentUrl: "https://www.useepulari.com.br/feminino/vestidos/", depth: 3, clicks: 185, impressions: 7500, ctr: 0.025, position: 4.8, topQuery: "vestido longo" },
    { url: "https://www.useepulari.com.br/feminino/esportes/top-academia", slug: "top-academia", name: "Top Academia", parentUrl: "https://www.useepulari.com.br/feminino/esportes/", depth: 3, clicks: 55, impressions: 3100, ctr: 0.018, position: 14.2, topQuery: "top academia feminino" },
    { url: "https://www.useepulari.com.br/feminino/saia-calca/saia-calca-curta", slug: "saia-calca-curta", name: "Saia Calça Curta", parentUrl: "https://www.useepulari.com.br/feminino/saia-calca/", depth: 3, clicks: 32, impressions: 1800, ctr: 0.018, position: 18.7, topQuery: "saia calça curta" },
  ];

  return mockData.map((d, i) => {
    const status = classifyCategory(d.position, d.impressions);
    const priorityScore = calculatePriorityScore(d.position, d.impressions);
    return { ...d, id: `prod-${i}`, status, priorityScore };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
