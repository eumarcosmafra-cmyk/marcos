"use client";

import { cn } from "@/lib/utils";
import { QUADRANT_CONFIG, type QuadrantType } from "@/lib/product-map/quadrants";
import type { CategoryAnalysis } from "@/lib/ga4/category-aggregation";

interface QuadrantMapProps {
  categories: CategoryAnalysis[];
  onCategoryClick: (cat: CategoryAnalysis) => void;
}

export function QuadrantMap({ categories, onCategoryClick }: QuadrantMapProps) {
  const quadrants: { key: QuadrantType; cats: CategoryAnalysis[] }[] = [
    { key: "protect", cats: categories.filter(c => c.quadrant === "protect") },
    { key: "attack", cats: categories.filter(c => c.quadrant === "attack") },
    { key: "reallocate", cats: categories.filter(c => c.quadrant === "reallocate") },
    { key: "ignore", cats: categories.filter(c => c.quadrant === "ignore") },
  ];

  // Layout: top row = protect | attack, bottom row = reallocate | ignore
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Headers */}
      <div className="col-span-2 grid grid-cols-2 gap-3">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Alta visibilidade</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Baixa visibilidade</p>
        </div>
      </div>

      {[
        [quadrants[0], quadrants[1]], // protect, attack (high commercial)
        [quadrants[2], quadrants[3]], // reallocate, ignore (low commercial)
      ].map((row, rowIdx) => (
        row.map((q) => {
          const cfg = QUADRANT_CONFIG[q.key];
          const totalRevenue = q.cats.reduce((s, c) => s + c.revenue, 0);
          const topCats = q.cats.sort((a, b) => b.revenue - a.revenue).slice(0, 3);

          return (
            <div
              key={q.key}
              className="rounded-xl p-4 transition-all"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
                  <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{cfg.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold" style={{ color: cfg.color }}>{q.cats.length}</p>
                  <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>categorias</p>
                </div>
              </div>

              {totalRevenue > 0 && (
                <p className="text-[10px] mb-2" style={{ color: "var(--text-secondary)" }}>
                  R$ {totalRevenue.toLocaleString("pt-BR")} em receita
                </p>
              )}

              <div className="space-y-1">
                {topCats.map(cat => (
                  <div
                    key={cat.category_name}
                    onClick={() => onCategoryClick(cat)}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 cursor-pointer transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold",
                        cat.abc_tier === "A" ? "bg-emerald-600/15 text-emerald-400" :
                        cat.abc_tier === "B" ? "bg-yellow-600/15 text-yellow-400" :
                        "bg-gray-600/15 text-gray-400"
                      )}>{cat.abc_tier}</span>
                      <span className="text-[10px] truncate" style={{ color: "var(--text-primary)" }}>{cat.category_name}</span>
                    </div>
                    <span className="text-[9px] shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
                      R$ {cat.revenue.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
                {q.cats.length > 3 && (
                  <p className="text-[9px] px-2" style={{ color: "var(--text-muted)" }}>
                    +{q.cats.length - 3} categorias
                  </p>
                )}
              </div>

              {/* Row label */}
              {q.key === "protect" || q.key === "reallocate" ? (
                <div className="absolute -left-16 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {rowIdx === 0 ? "Alta receita" : "Baixa receita"}
                </div>
              ) : null}
            </div>
          );
        })
      ))}
    </div>
  );
}
