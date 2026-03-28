import type { CategoryAnalysis } from "@/lib/ga4/category-aggregation";

export type QuadrantType = "protect" | "attack" | "reallocate" | "ignore";

export interface Alert {
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

export function assignQuadrant(
  visibilityScore: string,
  abcTier: string
): QuadrantType {
  const highVis = visibilityScore === "high" || visibilityScore === "medium";
  const highCom = abcTier === "A" || abcTier === "B";
  if (highVis && highCom) return "protect";
  if (!highVis && highCom) return "attack";
  if (highVis && !highCom) return "reallocate";
  return "ignore";
}

export function calculateOpportunityScore(cat: CategoryAnalysis): number {
  const impressions = cat.category_impressions || 0;
  const commercialWeight = cat.abc_tier === "A" ? 2.0 : cat.abc_tier === "B" ? 1.5 : 1.0;
  const coverageRatio = Math.max(0.1, cat.satellite_count / Math.max(1, cat.satellite_target));
  const pillarFactor = cat.pillar_exists ? 1.0 : 2.0;
  return Math.round((impressions * commercialWeight) / coverageRatio * pillarFactor);
}

export function detectAlerts(categories: CategoryAnalysis[]): CategoryAnalysis[] {
  const aTierCats = categories.filter(c => c.abc_tier === "A");
  const cTierWithContent = categories.filter(c => c.abc_tier === "C" && c.satellite_count >= c.satellite_target);

  return categories.map(cat => {
    const alerts: Alert[] = [...cat.alerts];

    // Orphan category: has revenue but zero GSC impressions
    if (cat.revenue > 0 && cat.category_impressions === 0) {
      if (!alerts.some(a => a.type === "orphan_category")) {
        alerts.push({
          type: "orphan_category",
          severity: "critical",
          message: `Categoria '${cat.category_name}' gera R$ ${cat.revenue.toLocaleString("pt-BR")} mas não aparece no Google.`,
        });
      }
    }

    // No content for A-tier
    if (cat.abc_tier === "A" && !cat.pillar_exists && cat.satellite_count === 0) {
      if (!alerts.some(a => a.type === "no_content")) {
        alerts.push({
          type: "no_content",
          severity: "critical",
          message: `Categoria A '${cat.category_name}' sem conteúdo de blog. Autoridade temática não suporta a categoria mais lucrativa.`,
        });
      }
    }

    // Depth gap: attack quadrant + few products
    if (cat.quadrant === "attack" && cat.product_count < 8) {
      if (!alerts.some(a => a.type === "depth_gap")) {
        alerts.push({
          type: "depth_gap",
          severity: "warning",
          message: `Categoria '${cat.category_name}' tem baixa visibilidade e apenas ${cat.product_count} produtos. Profundidade de catálogo pode estar limitando ranqueamento.`,
        });
      }
    }

    // Content-revenue misalignment
    if (cat.abc_tier === "A" && cat.satellite_count === 0 && cTierWithContent.length > 0) {
      const cCat = cTierWithContent[0];
      alerts.push({
        type: "no_content",
        severity: "critical",
        message: `Investimento invertido: '${cCat.category_name}' (Tier C) tem ${cCat.satellite_count} satélites, enquanto '${cat.category_name}' (Tier A) tem zero.`,
      });
    }

    return { ...cat, alerts };
  });
}

export function sortByOpportunity(categories: CategoryAnalysis[]): CategoryAnalysis[] {
  return [...categories].sort((a, b) => {
    const scoreA = calculateOpportunityScore(a);
    const scoreB = calculateOpportunityScore(b);
    return scoreB - scoreA;
  });
}

export const QUADRANT_CONFIG = {
  attack: {
    label: "Atacar",
    description: "Alta receita, baixa visibilidade — PRIORIDADE",
    color: "rgb(248, 113, 113)",
    bg: "rgba(248, 113, 113, 0.08)",
    border: "rgba(248, 113, 113, 0.25)",
    badge: "bg-red-600/15 text-red-400",
  },
  protect: {
    label: "Proteger",
    description: "Alta receita, boa visibilidade — manter posição",
    color: "rgb(52, 211, 153)",
    bg: "rgba(52, 211, 153, 0.08)",
    border: "rgba(52, 211, 153, 0.25)",
    badge: "bg-emerald-600/15 text-emerald-400",
  },
  reallocate: {
    label: "Realocar",
    description: "Baixa receita, boa visibilidade — auditar ROI",
    color: "rgb(251, 191, 36)",
    bg: "rgba(251, 191, 36, 0.08)",
    border: "rgba(251, 191, 36, 0.25)",
    badge: "bg-yellow-600/15 text-yellow-400",
  },
  ignore: {
    label: "Monitorar",
    description: "Baixa receita, baixa visibilidade — baixa prioridade",
    color: "rgb(156, 163, 175)",
    bg: "rgba(156, 163, 175, 0.08)",
    border: "rgba(156, 163, 175, 0.25)",
    badge: "bg-gray-600/15 text-gray-400",
  },
} as const;

export const ABC_CONFIG = {
  A: { label: "Tier A", badge: "bg-emerald-600/15 text-emerald-400" },
  B: { label: "Tier B", badge: "bg-yellow-600/15 text-yellow-400" },
  C: { label: "Tier C", badge: "bg-gray-600/15 text-gray-400" },
} as const;
