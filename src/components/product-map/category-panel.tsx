"use client";

import { X, TrendingUp, Eye, MousePointerClick, Sparkles, AlertTriangle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUADRANT_CONFIG, ABC_CONFIG } from "@/lib/product-map/quadrants";
import type { CategoryAnalysis } from "@/lib/ga4/category-aggregation";

interface CategoryPanelProps {
  category: CategoryAnalysis | null;
  onClose: () => void;
}

export function CategoryPanel({ category, onClose }: CategoryPanelProps) {
  if (!category) return null;

  const qCfg = QUADRANT_CONFIG[category.quadrant];
  const aCfg = ABC_CONFIG[category.abc_tier];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col overflow-y-auto"
        style={{ background: "var(--glass-bg)", borderLeft: "1px solid var(--glass-border)", backdropFilter: "blur(20px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{category.category_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", qCfg.badge)}>{qCfg.label}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", aCfg.badge)}>{aCfg.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10"><X className="h-4 w-4" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="flex-1 space-y-5 px-6 py-5">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-3">
              <TrendingUp className="h-3 w-3 mb-1" style={{ color: "var(--text-muted)" }} />
              <p className="text-lg font-bold" style={{ color: qCfg.color }}>R$ {category.revenue.toLocaleString("pt-BR")}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Receita ({category.revenue_share}%)</p>
            </div>
            <div className="glass-card p-3">
              <Eye className="h-3 w-3 mb-1" style={{ color: "var(--text-muted)" }} />
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{category.category_position?.toFixed(1) || "—"}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Posição GSC</p>
            </div>
            <div className="glass-card p-3">
              <FileText className="h-3 w-3 mb-1" style={{ color: "var(--text-muted)" }} />
              <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{category.satellite_count}/{category.satellite_target}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Cobertura blog</p>
            </div>
          </div>

          {/* Primary action */}
          <div className="rounded-lg p-3" style={{ background: qCfg.bg, border: `1px solid ${qCfg.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3.5 w-3.5" style={{ color: qCfg.color }} />
              <p className="text-[10px] font-semibold" style={{ color: qCfg.color }}>Próximo passo</p>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{category.primary_action}</p>
          </div>

          {/* Alerts */}
          {category.alerts.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Alertas</p>
              <div className="space-y-1.5">
                {category.alerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg px-2.5 py-2"
                    style={{ background: alert.severity === "critical" ? "rgba(248,113,113,0.08)" : "rgba(251,191,36,0.08)" }}>
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" style={{ color: alert.severity === "critical" ? "rgb(248,113,113)" : "rgb(251,191,36)" }} />
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GSC metrics */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Google Search Console</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Impressões", value: category.category_impressions.toLocaleString("pt-BR"), icon: Eye },
                { label: "Cliques", value: category.category_clicks.toLocaleString("pt-BR"), icon: MousePointerClick },
                { label: "CTR", value: `${(category.category_ctr * 100).toFixed(1)}%`, icon: TrendingUp },
                { label: "Produtos", value: category.product_count.toString(), icon: FileText },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                  <m.icon className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{m.value}</p>
                    <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top products */}
          {category.top_products.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Top Produtos</p>
              <div className="space-y-1">
                {category.top_products.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                    <p className="text-[10px] truncate flex-1" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                    <span className="text-[10px] shrink-0 ml-2" style={{ color: "var(--text-secondary)" }}>R$ {p.revenue.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* URL */}
          {category.category_url && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>URL</p>
              <a href={category.category_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline break-all">
                {category.category_url}
              </a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
