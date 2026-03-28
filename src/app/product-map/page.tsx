"use client";

import { useState, useMemo } from "react";
import { Map, Loader2, AlertTriangle, Eye, MousePointerClick, TrendingUp, Sparkles, Package, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";
import { CsvUpload } from "@/components/product-map/csv-upload";
import { QuadrantMap } from "@/components/product-map/quadrant-map";
import { CategoryPanel } from "@/components/product-map/category-panel";
import { PriorityQueue } from "@/components/product-map/priority-queue";
import { aggregateCategories, type CategoryAnalysis } from "@/lib/ga4/category-aggregation";
import { detectAlerts, sortByOpportunity, QUADRANT_CONFIG, ABC_CONFIG } from "@/lib/product-map/quadrants";
import type { ParseResult } from "@/lib/ga4/csv-parser";

// ---------------------------------------------------------------------------
// Mode type
// ---------------------------------------------------------------------------
type Mode = "diagnosis" | "monitoring" | "briefing";

// ---------------------------------------------------------------------------
// AI Diagnosis types
// ---------------------------------------------------------------------------
interface AIDiagnosis {
  executive_summary: string;
  biggest_opportunity: string;
  biggest_risk: string;
  top_actions: { action: string; category: string; revenue_at_stake: number; effort: string; timeline: string }[];
  content_gap_summary: string;
  abc_visibility_summary: string;
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; accent: string }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent)} />
        <span className={cn("text-2xl font-bold", accent)}>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</span>
      </div>
      <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ProductMapPage() {
  const [mode, setMode] = useState<Mode>("diagnosis");
  const [selectedSite, setSelectedSite] = useState("");
  const [csvData, setCsvData] = useState<ParseResult | null>(null);
  const [categories, setCategories] = useState<CategoryAnalysis[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryAnalysis | null>(null);
  const [diagnosis, setDiagnosis] = useState<AIDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  // Derived
  const sorted = useMemo(() => sortByOpportunity(categories), [categories]);
  const quadrantSummary = useMemo(() => {
    const q = { attack: { count: 0, revenue: 0 }, protect: { count: 0, revenue: 0 }, reallocate: { count: 0, revenue: 0 }, ignore: { count: 0, revenue: 0 } };
    for (const c of categories) { q[c.quadrant].count++; q[c.quadrant].revenue += c.revenue; }
    return q;
  }, [categories]);
  const totalRevenue = useMemo(() => categories.reduce((s, c) => s + c.revenue, 0), [categories]);
  const criticalAlerts = useMemo(() => categories.flatMap(c => c.alerts).filter(a => a.severity === "critical").slice(0, 3), [categories]);

  // Handle CSV parsed
  function handleCsvParsed(result: ParseResult) {
    setCsvData(result);
    setError(null);
  }

  // Run analysis
  async function handleAnalyze() {
    if (!csvData) { setError("Carregue o arquivo CSV do GA4 primeiro"); return; }
    setLoading(true);
    setError(null);
    setDiagnosis(null);

    try {
      // Aggregate categories from CSV (client-side)
      let cats = aggregateCategories(csvData.products);
      cats = detectAlerts(cats);
      cats = sortByOpportunity(cats);
      setCategories(cats);
      setAnalyzed(true);

      // Call AI for diagnosis (server-side)
      try {
        const res = await fetch("/api/product-map/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories: cats.slice(0, 20) }),
        });
        const data = await res.json();
        if (data.diagnosis) setDiagnosis(data.diagnosis);
      } catch (e) {
        console.error("[product-map] AI diagnosis failed:", e);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na análise");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header + Mode Selector */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              <Package className="h-5 w-5 text-brand-500" />
              Product Performance Map
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Mapa estratégico de produtos com curva ABC, quadrantes e diagnóstico IA
            </p>
          </div>
          <div className="flex rounded-lg" style={{ border: "1px solid var(--glass-border)" }}>
            {([
              { key: "diagnosis" as const, label: "Diagnóstico" },
              { key: "monitoring" as const, label: "Monitoramento" },
              { key: "briefing" as const, label: "Briefing" },
            ]).map(m => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={cn("px-3 py-1.5 text-[10px] font-medium transition-colors", mode === m.key ? "bg-brand-600 text-white" : "hover:bg-[var(--glass-hover)]")}
                style={mode !== m.key ? { color: "var(--text-muted)" } : undefined}
              >{m.label}</button>
            ))}
          </div>
        </div>

        {/* Input Section */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Site GSC (opcional)</label>
              <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
            </div>
            <button onClick={handleAnalyze} disabled={loading || !csvData}
              className={cn("btn-primary flex items-center gap-2 px-5 py-2 text-xs font-semibold", (loading || !csvData) && "opacity-50 cursor-not-allowed")}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Analisar
            </button>
          </div>
          <CsvUpload onParsed={handleCsvParsed} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card flex items-center justify-center gap-3 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Agregando categorias e gerando diagnóstico com IA...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card flex items-center gap-3 p-4" style={{ borderLeft: "3px solid rgb(248,113,113)" }}>
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Erro</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{error}</p>
            </div>
            <button onClick={handleAnalyze} className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[10px] font-medium text-white">Tentar novamente</button>
          </div>
        )}

        {/* Results */}
        {analyzed && !loading && (
          <>
            {/* Zone 1: KPIs */}
            <div className="grid grid-cols-5 gap-3">
              <KpiCard icon={Package} label="Categorias" value={categories.length} accent="text-brand-400" />
              <KpiCard icon={AlertTriangle} label="Atacar (prioridade)" value={quadrantSummary.attack.count} accent="text-red-400" />
              <KpiCard icon={TrendingUp} label="Proteger" value={quadrantSummary.protect.count} accent="text-emerald-400" />
              <KpiCard icon={Eye} label="Receita Total" value={`R$ ${(totalRevenue / 1000).toFixed(0)}K`} accent="text-brand-400" />
              <KpiCard icon={MousePointerClick} label="Receita em Risco" value={`R$ ${(quadrantSummary.attack.revenue / 1000).toFixed(0)}K`} accent="text-red-400" />
            </div>

            {/* AI Diagnosis */}
            {diagnosis && (
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                  <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Diagnóstico IA</p>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{diagnosis.executive_summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg p-3" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
                    <p className="text-[9px] font-medium text-emerald-400 mb-1">Maior oportunidade</p>
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{diagnosis.biggest_opportunity}</p>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                    <p className="text-[9px] font-medium text-red-400 mb-1">Maior risco</p>
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{diagnosis.biggest_risk}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <div className="space-y-1.5">
                {criticalAlerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{a.message}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Zone 2: Priority Queue */}
            <PriorityQueue categories={sorted} onCategoryClick={setSelectedCategory} />

            {/* Zone 3: Quadrant Map */}
            {mode === "diagnosis" && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Mapa de Quadrantes</h2>
                <QuadrantMap categories={sorted} onCategoryClick={setSelectedCategory} />
              </div>
            )}

            {/* Zone 3 alt: Category Table (briefing mode) */}
            {(mode === "briefing" || mode === "monitoring") && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Todas as Categorias ({sorted.length})
                </h2>
                <div className="glass-card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                        {["Categoria", "Tier", "Quadrante", "Receita", "Posição", "Impressões", "Produtos", "Ação"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] font-medium uppercase" style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(cat => {
                        const qCfg = QUADRANT_CONFIG[cat.quadrant];
                        return (
                          <tr key={cat.category_name} onClick={() => setSelectedCategory(cat)}
                            className="cursor-pointer transition-colors hover:bg-[var(--glass-hover)]"
                            style={{ borderBottom: "1px solid var(--glass-border)" }}>
                            <td className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-primary)" }}>{cat.category_name}</td>
                            <td className="px-3 py-2"><span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold", ABC_CONFIG[cat.abc_tier].badge)}>{cat.abc_tier}</span></td>
                            <td className="px-3 py-2"><span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-medium", qCfg.badge)}>{qCfg.label}</span></td>
                            <td className="px-3 py-2 text-xs text-right" style={{ color: "var(--text-secondary)" }}>R$ {cat.revenue.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2 text-xs text-right font-semibold" style={{ color: qCfg.color }}>{cat.category_position?.toFixed(1) || "—"}</td>
                            <td className="px-3 py-2 text-xs text-right" style={{ color: "var(--text-secondary)" }}>{cat.category_impressions.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2 text-xs text-right" style={{ color: "var(--text-secondary)" }}>{cat.product_count}</td>
                            <td className="px-3 py-2 text-[9px]" style={{ color: "var(--text-muted)" }}>{cat.primary_action.split(".")[0]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category Detail Panel */}
      <CategoryPanel category={selectedCategory} onClose={() => setSelectedCategory(null)} />
    </>
  );
}
