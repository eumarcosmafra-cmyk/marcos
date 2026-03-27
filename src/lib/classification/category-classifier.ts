import type { CategoryNode } from "@/types/category-map";

export type CategoryStatus = "well_positioned" | "opportunity" | "critical";

/**
 * Classify a category based on position and impressions.
 *
 * - Well positioned: position 1-5
 * - Opportunity: position 6-20 with meaningful impressions
 * - Critical: position > 20 or very low traction
 */
export function classifyCategory(position: number, impressions: number): CategoryStatus {
  if (position > 0 && position <= 5) return "well_positioned";
  if (position > 5 && position <= 20 && impressions >= 10) return "opportunity";
  return "critical";
}

/**
 * Calculate priority score for a category.
 * Higher score = higher priority for optimization effort.
 *
 * Formula: impressions * max(1, (21 - position))
 * This prioritizes categories with high search demand that are
 * close to but not yet in top positions.
 */
export function calculatePriorityScore(position: number, impressions: number): number {
  const positionMultiplier = Math.max(1, 21 - Math.min(position, 20));
  return Math.round(impressions * positionMultiplier);
}

/**
 * Generate a diagnostic text for a category.
 */
export function generateDiagnosis(category: CategoryNode): string {
  const { position, impressions, status } = category;

  if (status === "well_positioned") {
    return `Categoria consolidada na posição ${position.toFixed(1)} para "${category.topQuery}". Prioridade baixa de correção — foco em manter e proteger.`;
  }

  if (status === "opportunity") {
    if (position <= 10) {
      return `Categoria na borda do Top 10 (posição ${position.toFixed(1)}) com ${impressions.toLocaleString("pt-BR")} impressões. Otimização de conteúdo e title tag pode gerar ganho rápido de CTR.`;
    }
    if (position <= 15) {
      return `Forte potencial de ganho. ${impressions.toLocaleString("pt-BR")} impressões na posição ${position.toFixed(1)} — já existe demanda capturada, mas a URL ainda não ocupa o topo da SERP.`;
    }
    return `Oportunidade de médio prazo. Posição ${position.toFixed(1)} com ${impressions.toLocaleString("pt-BR")} impressões. Requer trabalho de conteúdo e autoridade para avançar.`;
  }

  // Critical
  if (impressions >= 100) {
    return `Baixa competitividade orgânica (posição ${position.toFixed(1)}) diante de ${impressions.toLocaleString("pt-BR")} impressões. Volume de busca existe, mas a página não compete.`;
  }
  return `Categoria com tração mínima — ${impressions} impressões e posição ${position.toFixed(1)}. Avaliar se vale investimento ou consolidação com outra URL.`;
}
