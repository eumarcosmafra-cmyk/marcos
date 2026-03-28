"use client";

import { cn } from "@/lib/utils";
import { QUADRANT_CONFIG, ABC_CONFIG, calculateOpportunityScore } from "@/lib/product-map/quadrants";
import type { CategoryAnalysis } from "@/lib/ga4/category-aggregation";

interface PriorityQueueProps {
  categories: CategoryAnalysis[];
  onCategoryClick: (cat: CategoryAnalysis) => void;
}

function getActionPill(cat: CategoryAnalysis): { label: string; style: string } {
  if (cat.quadrant === "attack" && !cat.pillar_exists) return { label: "Criar conteúdo", style: "bg-red-600/15 text-red-400" };
  if (cat.quadrant === "attack") return { label: "Otimizar SEO", style: "bg-red-600/15 text-red-400" };
  if (cat.category_impressions === 0 && cat.revenue > 0) return { label: "Verificar indexação", style: "bg-purple-600/15 text-purple-400" };
  if (cat.quadrant === "protect" && cat.satellite_count < cat.satellite_target) return { label: "Expandir conteúdo", style: "bg-blue-600/15 text-blue-400" };
  if (cat.quadrant === "reallocate") return { label: "Auditar ROI", style: "bg-yellow-600/15 text-yellow-400" };
  return { label: "Monitorar", style: "bg-gray-600/15 text-gray-400" };
}

export function PriorityQueue({ categories, onCategoryClick }: PriorityQueueProps) {
  const sorted = [...categories]
    .filter(c => c.quadrant === "attack" || (c.abc_tier === "A" && c.category_impressions === 0))
    .sort((a, b) => calculateOpportunityScore(b) - calculateOpportunityScore(a))
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
        Ações Prioritárias
      </h2>
      <div className="space-y-2">
        {sorted.map((cat, i) => {
          const pill = getActionPill(cat);
          const qCfg = QUADRANT_CONFIG[cat.quadrant];
          return (
            <div
              key={cat.category_name}
              onClick={() => onCategoryClick(cat)}
              className="glass-card flex items-center gap-4 p-3 cursor-pointer hover:bg-[var(--glass-hover)] transition-colors"
              style={{ borderLeft: `3px solid ${i < 2 ? "rgb(248,113,113)" : i < 4 ? "rgb(251,191,36)" : "rgb(52,211,153)"}` }}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cat.category_name}</p>
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold", ABC_CONFIG[cat.abc_tier].badge)}>
                    {cat.abc_tier}
                  </span>
                </div>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  R$ {cat.revenue.toLocaleString("pt-BR")} · Pos {cat.category_position?.toFixed(1) || "N/A"} · {cat.primary_action}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", pill.style)}>
                {pill.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
