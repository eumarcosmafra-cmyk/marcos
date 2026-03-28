"use client";

import { useState, useMemo } from "react";
import {
  Brain,
  Search,
  Loader2,
  Globe,
  TrendingUp,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  FileText,
  X,
  ArrowUpDown,
  MousePointerClick,
  Eye,
  Link2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClusterLayer {
  category_url: string | null;
  pillar_url: string | null;
  pillar_status: "exists" | "missing" | "weak";
  satellite_urls: string[];
  missing_satellites: string[];
}

interface Cluster {
  nome_cluster: string;
  cluster_type: "broad_pillar" | "medium" | "long_tail" | "seasonal";
  entidade_principal: string;
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
  // Computed fields (added post-AI)
  opportunity_score?: number;
  merged_from?: string[];
  urls?: { url: string; title: string; tipo_intencao: string }[];
  cobertura?: { atual: number; ideal: number; gap: number };
  diagnostico?: string;
  oportunidades?: string[];
  metricas?: { impressoes: number; cliques: number; ctr_medio: number };
  // Legacy compatibility
  total_urls?: number;
}

interface Analysis {
  clusters: Cluster[];
  to_validate: Cluster[];
  priority_queue: { cluster: string; reason: string; action: string }[];
  executive_summary: string;
  resumo: {
    total_urls: number;
    total_clusters: number;
    critical_gaps: number;
    overall_geo: string;
  };
}

// ---------------------------------------------------------------------------
// Score config (5-state)
// ---------------------------------------------------------------------------

const SCORE_CONFIG = {
  strong: { label: "Forte", bg: "bg-emerald-600/15", text: "text-emerald-400", color: "rgb(52, 211, 153)", bgBlock: "rgba(52, 211, 153, 0.12)", borderBlock: "rgba(52, 211, 153, 0.25)", borderLeft: "rgb(52, 211, 153)" },
  medium: { label: "Medio", bg: "bg-yellow-600/15", text: "text-yellow-400", color: "rgb(251, 191, 36)", bgBlock: "rgba(251, 191, 36, 0.12)", borderBlock: "rgba(251, 191, 36, 0.25)", borderLeft: "rgb(251, 191, 36)" },
  weak_real: { label: "Fraco", bg: "bg-red-600/15", text: "text-red-400", color: "rgb(248, 113, 113)", bgBlock: "rgba(248, 113, 113, 0.12)", borderBlock: "rgba(248, 113, 113, 0.25)", borderLeft: "rgb(248, 113, 113)" },
  no_data: { label: "Sem dados", bg: "bg-gray-600/15", text: "text-gray-400", color: "rgb(156, 163, 175)", bgBlock: "rgba(156, 163, 175, 0.12)", borderBlock: "rgba(156, 163, 175, 0.25)", borderLeft: "rgb(156, 163, 175)" },
  critical_gap: { label: "Gap critico", bg: "bg-purple-600/15", text: "text-purple-400", color: "rgb(192, 132, 252)", bgBlock: "rgba(192, 132, 252, 0.12)", borderBlock: "rgba(192, 132, 252, 0.25)", borderLeft: "rgb(192, 132, 252)" },
  // Legacy fallbacks
  forte: { label: "Forte", bg: "bg-emerald-600/15", text: "text-emerald-400", color: "rgb(52, 211, 153)", bgBlock: "rgba(52, 211, 153, 0.12)", borderBlock: "rgba(52, 211, 153, 0.25)", borderLeft: "rgb(52, 211, 153)" },
  medio: { label: "Medio", bg: "bg-yellow-600/15", text: "text-yellow-400", color: "rgb(251, 191, 36)", bgBlock: "rgba(251, 191, 36, 0.12)", borderBlock: "rgba(251, 191, 36, 0.25)", borderLeft: "rgb(251, 191, 36)" },
  fraco: { label: "Fraco", bg: "bg-red-600/15", text: "text-red-400", color: "rgb(248, 113, 113)", bgBlock: "rgba(248, 113, 113, 0.12)", borderBlock: "rgba(248, 113, 113, 0.25)", borderLeft: "rgb(248, 113, 113)" },
} as const;

const GEO_CONFIG = {
  high: { label: "Alto", bg: "bg-emerald-600/15", text: "text-emerald-400" },
  medium: { label: "Medio", bg: "bg-yellow-600/15", text: "text-yellow-400" },
  low: { label: "Baixo", bg: "bg-red-600/15", text: "text-red-400" },
} as const;

const INTENTION_CONFIG: Record<string, { bg: string; text: string }> = {
  informacional: { bg: "bg-blue-600/15", text: "text-blue-400" },
  comercial: { bg: "bg-purple-600/15", text: "text-purple-400" },
  transacional: { bg: "bg-emerald-600/15", text: "text-emerald-400" },
  navegacional: { bg: "bg-gray-600/15", text: "text-gray-400" },
};

const PILLAR_STATUS_CONFIG = {
  exists: { label: "Existe", bg: "bg-emerald-600/15", text: "text-emerald-400" },
  missing: { label: "Faltando", bg: "bg-red-600/15", text: "text-red-400" },
  weak: { label: "Fraco", bg: "bg-yellow-600/15", text: "text-yellow-400" },
} as const;

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: accent ?? "var(--text-muted)" }} />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold" style={{ color: accent ?? "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intention Badge
// ---------------------------------------------------------------------------

function IntentionBadge({ tipo }: { tipo: string }) {
  const cfg = INTENTION_CONFIG[tipo.toLowerCase()] ?? INTENTION_CONFIG.informacional;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.bg, cfg.text)}>
      {tipo}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Score Badge (5-state)
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: string }) {
  const cfg = SCORE_CONFIG[score as keyof typeof SCORE_CONFIG] ?? SCORE_CONFIG.no_data;
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Coverage Bar
// ---------------------------------------------------------------------------

function CoverageBar({ atual, ideal, gap }: { atual: number; ideal: number; gap: number }) {
  const pct = ideal > 0 ? Math.min((atual / ideal) * 100, 100) : 0;
  const barColor = pct >= 80 ? "rgb(52, 211, 153)" : pct >= 50 ? "rgb(251, 191, 36)" : "rgb(248, 113, 113)";

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span style={{ color: "var(--text-muted)" }}>
          Cobertura: {atual}/{ideal} URLs
        </span>
        <span style={{ color: barColor }} className="font-semibold">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className="h-2 w-full rounded-full overflow-hidden"
        style={{ background: "var(--glass-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      {gap > 0 && (
        <p className="mt-1 text-[10px] font-medium" style={{ color: "rgb(248, 113, 113)" }}>
          <AlertTriangle className="inline h-3 w-3 mr-0.5 -mt-0.5" />
          {gap} URL{gap > 1 ? "s" : ""} faltando para cobertura ideal
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cluster Card (collapsed by default, expandable)
// ---------------------------------------------------------------------------

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SCORE_CONFIG[cluster.score as keyof typeof SCORE_CONFIG] ?? SCORE_CONFIG.no_data;

  const satelliteCount = cluster.layers?.satellite_urls?.length ?? cluster.cobertura?.atual ?? 0;
  const target = cluster.satellite_target ?? cluster.cobertura?.ideal ?? 5;
  const coverageAtual = cluster.cobertura?.atual ?? satelliteCount;
  const coverageIdeal = cluster.cobertura?.ideal ?? target;
  const coverageGap = cluster.cobertura?.gap ?? Math.max(0, coverageIdeal - coverageAtual);
  const impressions = cluster.gsc_impressions ?? cluster.metricas?.impressoes ?? 0;

  return (
    <div
      className="glass-card overflow-hidden transition-all"
      style={{ borderLeft: `3px solid ${cfg.borderLeft}` }}
    >
      {/* Collapsed header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {cluster.nome_cluster}
              </h3>
              <ScoreBadge score={cluster.score} />
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {impressions.toLocaleString("pt-BR")} impressoes | {coverageAtual}/{coverageIdeal} URLs
            </p>
          </div>
        </div>

        {/* Coverage mini-bar */}
        <div className="flex items-center gap-3 ml-3">
          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-border)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${coverageIdeal > 0 ? Math.min((coverageAtual / coverageIdeal) * 100, 100) : 0}%`,
                background: cfg.borderLeft,
              }}
            />
          </div>
          {cluster.cluster_type && (
            <span className="rounded-full bg-brand-600/15 px-2 py-0.5 text-[9px] font-medium text-brand-400 shrink-0">
              {cluster.cluster_type.replace("_", " ")}
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          {/* Layers section */}
          {cluster.layers && (
            <div className="pt-4 space-y-3">
              <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Estrutura do Cluster
              </p>

              {/* Category */}
              <div className="flex items-center gap-2 text-xs">
                <Link2 className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>Categoria:</span>
                {cluster.layers.category_url ? (
                  <a href={cluster.layers.category_url} target="_blank" rel="noopener noreferrer"
                    className="truncate hover:underline" style={{ color: "var(--text-primary)" }}>
                    {cluster.layers.category_url}
                  </a>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Nao identificada</span>
                )}
              </div>

              {/* Pillar */}
              <div className="flex items-center gap-2 text-xs">
                <FileText className="h-3 w-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>Pillar:</span>
                {cluster.layers.pillar_url ? (
                  <a href={cluster.layers.pillar_url} target="_blank" rel="noopener noreferrer"
                    className="truncate hover:underline" style={{ color: "var(--text-primary)" }}>
                    {cluster.layers.pillar_url}
                  </a>
                ) : (
                  <span className="text-red-400 text-[10px] font-medium">Criar pillar</span>
                )}
                {cluster.layers.pillar_status && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium",
                    PILLAR_STATUS_CONFIG[cluster.layers.pillar_status]?.bg ?? "bg-gray-600/15",
                    PILLAR_STATUS_CONFIG[cluster.layers.pillar_status]?.text ?? "text-gray-400"
                  )}>
                    {PILLAR_STATUS_CONFIG[cluster.layers.pillar_status]?.label ?? cluster.layers.pillar_status}
                  </span>
                )}
              </div>

              {/* Existing satellites */}
              {cluster.layers.satellite_urls?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Satellites existentes ({cluster.layers.satellite_urls.length})
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {cluster.layers.satellite_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="block text-[10px] truncate rounded-lg px-2 py-1 hover:underline"
                        style={{ color: "var(--text-secondary)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing satellites */}
              {cluster.layers.missing_satellites?.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium mb-1.5" style={{ color: "rgb(248, 113, 113)" }}>
                    Satellites sugeridos ({cluster.layers.missing_satellites.length})
                  </p>
                  <div className="space-y-1">
                    {cluster.layers.missing_satellites.map((title, i) => (
                      <div key={i}
                        className="flex items-center gap-2 text-[10px] rounded-lg px-2 py-1"
                        style={{ color: "var(--text-secondary)", background: "rgba(248, 113, 113, 0.06)", border: "1px solid rgba(248, 113, 113, 0.15)" }}>
                        <Target className="h-3 w-3 flex-shrink-0" style={{ color: "rgb(248, 113, 113)" }} />
                        {title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Coverage bar */}
          <CoverageBar atual={coverageAtual} ideal={coverageIdeal} gap={coverageGap} />

          {/* GEO section */}
          {cluster.geo_score && (
            <div className="glass-card p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  GEO Score
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium",
                  GEO_CONFIG[cluster.geo_score]?.bg ?? "bg-gray-600/15",
                  GEO_CONFIG[cluster.geo_score]?.text ?? "text-gray-400"
                )}>
                  {GEO_CONFIG[cluster.geo_score]?.label ?? cluster.geo_score}
                </span>
              </div>
              {cluster.geo_recommendation && (
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {cluster.geo_recommendation}
                </p>
              )}
            </div>
          )}

          {/* Score reasoning */}
          {cluster.score_reasoning && (
            <div
              className="rounded-lg p-3"
              style={{ background: cfg.bgBlock, border: `1px solid ${cfg.borderBlock}` }}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: cfg.color }}>
                Diagnostico
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {cluster.score_reasoning}
              </p>
            </div>
          )}

          {/* Legacy: URLs list */}
          {cluster.urls && cluster.urls.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                URLs ({cluster.urls.length})
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {cluster.urls.map((u, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg p-2"
                    style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {u.title || u.url}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                        {u.url}
                      </p>
                    </div>
                    <IntentionBadge tipo={u.tipo_intencao} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy: Opportunities */}
          {cluster.oportunidades && cluster.oportunidades.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Oportunidades
              </p>
              <ul className="space-y-1">
                {cluster.oportunidades.map((op, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Target className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                    {op}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Merged from */}
          {cluster.merged_from && cluster.merged_from.length > 0 && (
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Merge de: {cluster.merged_from.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContentIntelligencePage() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [period, setPeriod] = useState("3m");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [validateExpanded, setValidateExpanded] = useState(false);

  // Sort clusters by opportunity_score desc (already sorted by API, but keep stable)
  const sortedClusters = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.clusters].sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0));
  }, [analysis]);

  async function apiCall(body: Record<string, unknown>) {
    const res = await fetch("/api/content-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
    return data;
  }

  // Run analysis in batches
  async function handleAnalyze() {
    if (!sitemapUrl.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setProgress("Escaneando sitemap e buscando dados do GSC...");

    try {
      // Step 1: Scan
      const scanResult = await apiCall({
        step: "scan",
        sitemapUrl: sitemapUrl.trim(),
        siteUrl: selectedSite || undefined,
        period,
      });

      const { batches, totalUrls, totalBatches } = scanResult;
      setProgress(`${totalUrls} URLs encontradas. Classificando em ${totalBatches} lotes...`);

      // Step 2: Analyze each batch
      const allClassifications: unknown[] = [];
      for (let i = 0; i < batches.length; i++) {
        setProgress(`Analisando lote ${i + 1} de ${totalBatches} (${batches[i].urls.length} URLs)...`);
        const batchResult = await apiCall({
          step: "analyze_batch",
          batchData: {
            urls: batches[i].urls,
            batchIndex: i,
            totalBatches,
          },
        });
        allClassifications.push(...(batchResult.classifications || []));
      }

      // Step 3: Merge and generate final analysis
      setProgress("Gerando diagnostico final com IA...");
      const mergeResult = await apiCall({
        step: "merge",
        batchData: { classifications: allClassifications },
      });

      const result = mergeResult.analysis as Analysis;
      if (!result || !result.clusters) throw new Error("Resposta da IA incompleta");

      // Normalize for backward compat: ensure to_validate, priority_queue, resumo exist
      if (!result.to_validate) result.to_validate = [];
      if (!result.priority_queue) {
        // Legacy: convert priorizacao if it exists
        const legacy = result as any;
        if (legacy.priorizacao) {
          result.priority_queue = legacy.priorizacao.map((p: any) => ({
            cluster: p.cluster,
            reason: p.motivo || p.reason || "",
            action: p.action || "Expandir",
          }));
        } else {
          result.priority_queue = [];
        }
      }
      if (!result.executive_summary) result.executive_summary = "";
      if (!result.resumo) {
        const legacy = result as any;
        result.resumo = {
          total_urls: legacy.resumo?.total_urls ?? result.clusters.length,
          total_clusters: legacy.resumo?.total_clusters ?? result.clusters.length,
          critical_gaps: legacy.resumo?.critical_gaps ?? 0,
          overall_geo: legacy.resumo?.overall_geo ?? "medium",
        };
      }

      setAnalysis(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* ---- Header ---- */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Content Intelligence
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Analise a cobertura de conteudo do seu site com IA. Identifique clusters tematicos, gaps e oportunidades.
          </p>
        </div>

        {/* ---- Input Section ---- */}
        <div className="glass-card p-5">
          <div className="flex flex-wrap items-end gap-4">
            {/* Sitemap URL */}
            <div className="flex-1 min-w-[280px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                URL do Sitemap
              </label>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <input
                  type="url"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* GSC Site Selector */}
            <div className="min-w-[200px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Site GSC
              </label>
              <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
            </div>

            {/* Period */}
            <div className="min-w-[160px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Periodo
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="last7days">Ultimos 7 dias</option>
                <option value="last28days">Ultimos 28 dias</option>
                <option value="last3months">Ultimos 3 meses</option>
                <option value="last6months">Ultimos 6 meses</option>
              </select>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !sitemapUrl.trim()}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all",
                loading || !sitemapUrl.trim()
                  ? "cursor-not-allowed opacity-50"
                  : "hover:opacity-90"
              )}
              style={{ background: "var(--brand-primary)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analisar
            </button>
          </div>
        </div>

        {/* ---- Loading State ---- */}
        {loading && (
          <div className="glass-card flex flex-col items-center justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: "var(--brand-primary)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {progress || "Analisando conteudo com IA..."}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              Processamento em lotes — cada lote leva ~15 segundos
            </p>
          </div>
        )}

        {/* ---- Error State ---- */}
        {error && (
          <div
            className="glass-card flex items-center gap-3 p-4"
            style={{ borderLeft: "3px solid rgb(248, 113, 113)" }}
          >
            <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: "rgb(248, 113, 113)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Erro na analise
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{error}</p>
            </div>
          </div>
        )}

        {/* ---- Results ---- */}
        {analysis && !loading && (
          <>
            {/* Zone 1: Executive Summary */}
            <div className="space-y-4">
              {/* 4 metric cards */}
              <div className="grid grid-cols-4 gap-3">
                <KpiCard icon={FileText} label="URLs Analisadas" value={analysis.resumo.total_urls} accent="text-brand-400" />
                <KpiCard icon={Layers} label="Clusters Reais" value={analysis.resumo.total_clusters} accent="text-brand-400" />
                <KpiCard icon={AlertTriangle} label="Gaps Criticos" value={analysis.resumo.critical_gaps} accent="text-red-400" />
                <KpiCard icon={Zap} label="GEO Score" value={analysis.resumo.overall_geo} accent="text-emerald-400" />
              </div>

              {/* AI diagnosis */}
              {analysis.executive_summary && (
                <div className="glass-card p-4">
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {analysis.executive_summary}
                  </p>
                </div>
              )}
            </div>

            {/* Zone 2: Priority Queue */}
            {analysis.priority_queue.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                  Acoes Prioritarias
                </h2>
                <div className="space-y-2">
                  {analysis.priority_queue.slice(0, 5).map((item, i) => (
                    <div key={i} className="glass-card flex items-center gap-4 p-3"
                      style={{ borderLeft: `3px solid ${i < 2 ? 'rgb(248,113,113)' : i < 4 ? 'rgb(251,191,36)' : 'rgb(52,211,153)'}` }}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold"
                        style={{ color: "var(--text-primary)" }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{item.cluster}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.reason}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium",
                        item.action.includes("Criar") ? "bg-red-600/15 text-red-400" :
                        item.action.includes("GEO") ? "bg-purple-600/15 text-purple-400" :
                        item.action.includes("link") ? "bg-yellow-600/15 text-yellow-400" :
                        "bg-blue-600/15 text-blue-400"
                      )}>{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zone 3: Cluster List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Clusters ({sortedClusters.length})
                </h2>
              </div>
              <div className="space-y-3">
                {sortedClusters.map((cluster, i) => (
                  <ClusterCard key={i} cluster={cluster} />
                ))}
              </div>
            </div>

            {/* To Validate section */}
            {analysis.to_validate && analysis.to_validate.length > 0 && (
              <div>
                <div
                  className="flex items-center gap-2 cursor-pointer mb-3"
                  onClick={() => setValidateExpanded((v) => !v)}
                >
                  {validateExpanded ? (
                    <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  )}
                  <h2 className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    A Validar ({analysis.to_validate.length} clusters sem dados)
                  </h2>
                </div>
                {validateExpanded && (
                  <div className="space-y-3 opacity-70">
                    {analysis.to_validate.map((cluster, i) => (
                      <ClusterCard key={i} cluster={cluster} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
