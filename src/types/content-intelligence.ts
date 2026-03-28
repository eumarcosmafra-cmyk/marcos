export interface ClusterLayer {
  category_url: string | null;
  pillar_url: string | null;
  pillar_status: "exists" | "missing" | "weak";
  satellite_urls: string[];
  missing_satellites: string[];
}

export interface Cluster {
  cluster_name: string;
  nome_cluster?: string;
  cluster_type: "broad_pillar" | "medium" | "long_tail" | "seasonal";
  central_entity: string;
  entidade_principal?: string;
  satellite_target: number;
  layers: ClusterLayer;
  score: "strong" | "medium" | "weak_real" | "no_data" | "critical_gap";
  score_reasoning: string;
  geo_score: "high" | "medium" | "low";
  geo_recommendation: string;
  gsc_impressions: number;
  gsc_clicks: number;
  internal_links_to_category: boolean;
  merge_candidates: string[];
  merged_from?: string[];
  opportunity_score?: number;
  total_urls?: number;
  cobertura?: { atual: number; ideal: number; gap: number };
  metricas?: { impressoes: number; cliques: number; ctr_medio: number };
}

export interface PriorityQueueItem {
  cluster: string;
  reason: string;
  action: string;
}

export interface ClusterAnalysis {
  clusters: Cluster[];
  to_validate?: Cluster[];
  executive_summary: string;
  priority_queue: PriorityQueueItem[];
  resumo: {
    total_urls: number;
    total_clusters: number;
    critical_gaps: number;
    overall_geo: string;
    zero_visibility?: number;
    sitemap_orphans?: number;
  };
  gaps?: {
    zeroVisibility: string[];
    sitemapOrphans: string[];
  };
}
