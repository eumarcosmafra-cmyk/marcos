export interface CategoryNode {
  id: string;
  url: string;
  slug: string;
  name: string;
  parentUrl: string | null;
  depth: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQuery: string;
  status: "well_positioned" | "opportunity" | "critical";
  priorityScore: number;
}

export interface CategoryMapData {
  categories: CategoryNode[];
  totals: {
    total: number;
    wellPositioned: number;
    opportunity: number;
    critical: number;
    totalClicks: number;
    totalImpressions: number;
  };
  siteUrl: string;
  analyzedAt: string;
}

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  priority?: string;
}
