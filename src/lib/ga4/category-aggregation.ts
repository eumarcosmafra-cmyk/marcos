import type { ProductData } from './csv-parser';

export interface CategoryAnalysis {
  category_name: string;
  category_url: string;
  revenue: number;
  units_sold: number;
  revenue_share: number;
  abc_tier: 'A' | 'B' | 'C';
  product_count: number;
  top_products: { name: string; revenue: number; units: number }[];
  category_position: number | null;
  category_impressions: number;
  category_clicks: number;
  category_ctr: number;
  pillar_exists: boolean;
  satellite_count: number;
  satellite_target: number;
  content_coverage_ratio: number;
  visibility_score: 'high' | 'medium' | 'low' | 'none';
  commercial_score: 'A' | 'B' | 'C';
  quadrant: 'protect' | 'attack' | 'reallocate' | 'ignore';
  alerts: { type: string; severity: 'critical' | 'warning' | 'info'; message: string }[];
  primary_action: string;
  action_type: 'seo' | 'content' | 'catalog' | 'conversion';
}

function getVisibilityScore(position: number | null, impressions: number): 'high' | 'medium' | 'low' | 'none' {
  if (!position || impressions === 0) return 'none';
  if (position <= 10 && impressions > 1000) return 'high';
  if (position <= 20 || impressions >= 200) return 'medium';
  return 'low';
}

function getQuadrant(visibility: string, abc: string): 'protect' | 'attack' | 'reallocate' | 'ignore' {
  const highVis = visibility === 'high' || visibility === 'medium';
  const highCom = abc === 'A' || abc === 'B';
  if (highVis && highCom) return 'protect';
  if (!highVis && highCom) return 'attack';
  if (highVis && !highCom) return 'reallocate';
  return 'ignore';
}

function getPrimaryAction(quadrant: string, pillarExists: boolean, coverage: number): { action: string; type: 'seo' | 'content' | 'catalog' | 'conversion' } {
  switch (quadrant) {
    case 'attack':
      if (!pillarExists) return { action: 'Criar pillar de blog e otimizar categoria para SEO', type: 'content' };
      return { action: 'Otimizar página de categoria e criar satélites de blog', type: 'seo' };
    case 'protect':
      if (coverage < 0.5) return { action: 'Expandir cobertura de conteúdo para proteger posição', type: 'content' };
      return { action: 'Monitorar posições e otimizar conversão', type: 'conversion' };
    case 'reallocate':
      return { action: 'Avaliar se investimento de SEO está gerando retorno comercial', type: 'catalog' };
    default:
      return { action: 'Monitorar — baixa prioridade', type: 'seo' };
  }
}

export function aggregateCategories(products: ProductData[], gscData?: { url: string; position: number; impressions: number; clicks: number; ctr: number }[]): CategoryAnalysis[] {
  // Group by category
  const categoryMap = new Map<string, ProductData[]>();
  for (const p of products) {
    const existing = categoryMap.get(p.category) || [];
    existing.push(p);
    categoryMap.set(p.category, existing);
  }

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);

  // Calculate ABC tiers
  const categories = Array.from(categoryMap.entries()).map(([name, prods]) => ({
    name,
    products: prods,
    revenue: prods.reduce((s, p) => s + p.revenue, 0),
  })).sort((a, b) => b.revenue - a.revenue);

  let cumRevenue = 0;
  const tiered = categories.map(c => {
    cumRevenue += c.revenue;
    const cumShare = totalRevenue > 0 ? cumRevenue / totalRevenue : 0;
    const tier: 'A' | 'B' | 'C' = cumShare <= 0.7 ? 'A' : cumShare <= 0.9 ? 'B' : 'C';
    return { ...c, tier };
  });

  // Build CategoryAnalysis for each
  return tiered.map(c => {
    const revenueShare = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
    const topProducts = c.products
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map(p => ({ name: p.name, revenue: p.revenue, units: p.unitsSold }));

    // Find GSC data for this category (fuzzy match by slug)
    const catSlug = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const gsc = gscData?.find(g => {
      const urlSlug = g.url.toLowerCase().split('/').filter(Boolean).pop() || '';
      return urlSlug.includes(catSlug) || catSlug.includes(urlSlug);
    });

    const catPosition = gsc?.position || null;
    const catImpressions = gsc?.impressions || 0;
    const catClicks = gsc?.clicks || 0;
    const catCtr = gsc?.ctr || 0;
    const catUrl = gsc?.url || '';

    const visibility = getVisibilityScore(catPosition, catImpressions);
    const quadrant = getQuadrant(visibility, c.tier);
    const satelliteTarget = c.tier === 'A' ? 8 : c.tier === 'B' ? 5 : 2;
    const { action, type } = getPrimaryAction(quadrant, false, 0);

    // Generate alerts
    const alerts: { type: string; severity: 'critical' | 'warning' | 'info'; message: string }[] = [];

    if (c.revenue > 0 && catImpressions === 0) {
      alerts.push({ type: 'orphan_category', severity: 'critical', message: `Categoria '${c.name}' gera R$ ${c.revenue.toLocaleString('pt-BR')} mas não aparece no Google.` });
    }
    if (c.tier === 'A' && quadrant === 'attack') {
      alerts.push({ type: 'no_content', severity: 'critical', message: `Categoria A '${c.name}' sem conteúdo de blog. Autoridade temática não suporta a categoria mais lucrativa.` });
    }
    if (quadrant === 'attack' && c.products.length < 8) {
      alerts.push({ type: 'depth_gap', severity: 'warning', message: `Categoria '${c.name}' tem baixa visibilidade e apenas ${c.products.length} produtos.` });
    }

    return {
      category_name: c.name,
      category_url: catUrl,
      revenue: c.revenue,
      units_sold: c.products.reduce((s, p) => s + p.unitsSold, 0),
      revenue_share: Number(revenueShare.toFixed(1)),
      abc_tier: c.tier,
      product_count: c.products.length,
      top_products: topProducts,
      category_position: catPosition,
      category_impressions: catImpressions,
      category_clicks: catClicks,
      category_ctr: catCtr,
      pillar_exists: false,
      satellite_count: 0,
      satellite_target: satelliteTarget,
      content_coverage_ratio: 0,
      visibility_score: visibility,
      commercial_score: c.tier,
      quadrant,
      alerts,
      primary_action: action,
      action_type: type,
    };
  });
}
