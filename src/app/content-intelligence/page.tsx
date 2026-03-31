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
  ChevronDown,
  ChevronRight,
  Zap,
  FileText,
  Eye,
  MousePointerClick,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClusterUrl {
  url: string;
  title: string;
  impressions: number;
  clicks: number;
  position: number;
  top_query: string;
}

interface Cluster {
  nome_cluster: string;
  total_urls: number;
  gsc_impressions: number;
  gsc_clicks: number;
  avg_position: number;
  ctr: number;
  top_url: string;
  top_query: string;
  urls: ClusterUrl[];
  score: "strong" | "medium" | "weak";
}

interface Analysis {
  clusters: Cluster[];
  resumo: {
    total_urls: number;
    total_clusters: number;
    total_impressions: number;
    total_clicks: number;
  };
  gaps?: {
    zeroVisibility: string[];
    sitemapOrphans: string[];
  };
}

// ---------------------------------------------------------------------------
// Score config
// ---------------------------------------------------------------------------

const SCORE_CONFIG = {
  strong: { label: "Forte", bg: "bg-emerald-600/15", text: "text-emerald-400", color: "rgb(52, 211, 153)", border: "rgba(52, 211, 153, 0.25)" },
  medium: { label: "Médio", bg: "bg-yellow-600/15", text: "text-yellow-400", color: "rgb(251, 191, 36)", border: "rgba(251, 191, 36, 0.25)" },
  weak: { label: "Fraco", bg: "bg-red-600/15", text: "text-red-400", color: "rgb(248, 113, 113)", border: "rgba(248, 113, 113, 0.25)" },
} as const;

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", accent)} />
        <span className={cn("text-2xl font-bold", accent)}>
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </span>
      </div>
      <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cluster Card
// ---------------------------------------------------------------------------

function ClusterCard({ cluster }: { cluster: Cluster }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SCORE_CONFIG[cluster.score] || SCORE_CONFIG.weak;

  return (
    <div
      className="glass-card overflow-hidden transition-all"
      style={{ borderLeft: `3px solid ${cfg.color}` }}
    >
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--glass-hover)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {cluster.nome_cluster}
            </p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", cfg.bg, cfg.text)}>
              {cfg.label}
            </span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
              {cluster.total_urls} {cluster.total_urls === 1 ? "post" : "posts"}
            </span>
          </div>
          <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            Top query: {cluster.top_query}
          </p>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {cluster.gsc_impressions.toLocaleString("pt-BR")}
            </p>
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>impressões</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {cluster.gsc_clicks.toLocaleString("pt-BR")}
            </p>
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>cliques</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: cfg.color }}>
              {cluster.avg_position > 0 ? cluster.avg_position.toFixed(1) : "—"}
            </p>
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>posição</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {cluster.ctr}%
            </p>
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>CTR</p>
          </div>
        </div>
      </div>

      {/* Expanded — URL list */}
      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <div className="pt-3 space-y-1.5">
            {cluster.urls.map((u, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--glass-hover)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {u.title}
                  </p>
                  <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>
                    {u.top_query} · {u.url}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <span>{u.impressions.toLocaleString("pt-BR")} imp</span>
                  <span>{u.clicks} cli</span>
                  <span>pos {u.position > 0 ? u.position.toFixed(1) : "—"}</span>
                </div>
                <a href={u.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                </a>
              </div>
            ))}
          </div>
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
  const [topN, setTopN] = useState(100);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [gapsExpanded, setGapsExpanded] = useState(false);

  const sortedClusters = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.clusters].sort((a, b) => b.gsc_impressions - a.gsc_impressions);
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

  async function handleAnalyze() {
    if (!selectedSite) {
      setError("Selecione um site do GSC para começar.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setProgress("Buscando dados do GSC para URLs de blog...");

    try {
      // Step 1: Scan — fetch GSC data
      const scanResult = await apiCall({
        step: "scan",
        siteUrl: selectedSite,
        sitemapUrl: sitemapUrl.trim() || undefined,
        period,
        topN,
      });

      setProgress(`${scanResult.totalUrls} URLs encontradas. Agrupando por tema...`);

      // Step 2: Cluster — deterministic grouping (no AI)
      const clusterResult = await apiCall({
        step: "cluster",
        urls: scanResult.urls,
        gaps: scanResult.gaps,
      });

      if (!clusterResult.analysis) throw new Error("Erro no agrupamento");
      setAnalysis(clusterResult.analysis);
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
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain className="h-6 w-6 text-brand-500" />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
              Content Intelligence
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Dashboard visual de clusters de conteúdo. Dados reais do GSC, agrupamento automático por tema.
          </p>
        </div>

        {/* Input Section */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* GSC Site */}
            <div className="min-w-[220px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Site GSC (obrigatório)
              </label>
              <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
            </div>

            {/* Period */}
            <div className="min-w-[140px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Período
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
              >
                <option value="28d">Últimos 28 dias</option>
                <option value="3m">Últimos 3 meses</option>
                <option value="6m">Últimos 6 meses</option>
              </select>
            </div>

            {/* Top N */}
            <div className="min-w-[140px]">
              <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Top URLs: {topN}
              </label>
              <div className="flex rounded-lg" style={{ border: "1px solid var(--glass-border)" }}>
                {[50, 100, 150, 200].map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={cn("px-2.5 py-2 text-[10px] font-medium transition-colors", topN === n ? "bg-brand-600 text-white" : "hover:bg-[var(--glass-hover)]")}
                    style={topN !== n ? { color: "var(--text-muted)" } : undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedSite}
              className={cn(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all",
                loading || !selectedSite ? "cursor-not-allowed opacity-50" : "hover:opacity-90"
              )}
              style={{ background: "var(--brand-primary)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analisar
            </button>
          </div>

          {/* Sitemap optional */}
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
              Sitemap do blog (opcional — para detectar posts sem tráfego)
            </label>
            <input
              type="url"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="https://example.com/sitemap-blog.xml"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card flex flex-col items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-400" />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {progress || "Carregando..."}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card flex items-center gap-3 p-4" style={{ borderLeft: "3px solid rgb(248, 113, 113)" }}>
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Erro na análise</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{error}</p>
            </div>
            <button onClick={handleAnalyze} className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[10px] font-medium text-white hover:opacity-90">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Results */}
        {analysis && !loading && (
          <>
            {/* Zone 1: KPIs */}
            <div className="grid grid-cols-4 gap-3">
              <KpiCard icon={FileText} label="URLs Analisadas" value={analysis.resumo.total_urls} accent="text-brand-400" />
              <KpiCard icon={Layers} label="Clusters" value={analysis.resumo.total_clusters} accent="text-brand-400" />
              <KpiCard icon={Eye} label="Impressões" value={analysis.resumo.total_impressions} accent="text-brand-400" />
              <KpiCard icon={MousePointerClick} label="Cliques" value={analysis.resumo.total_clicks} accent="text-brand-400" />
            </div>

            {/* Zone 2: Cluster cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Clusters de Conteúdo ({sortedClusters.length})
                </h2>
                <div className="flex items-center gap-3 text-[9px]" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Forte (&gt;1K imp)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" /> Médio (100-1K)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Fraco (&lt;100)</span>
                </div>
              </div>
              <div className="space-y-2">
                {sortedClusters.map((cluster, i) => (
                  <ClusterCard key={i} cluster={cluster} />
                ))}
              </div>
            </div>

            {/* Zone 3: Gap detection */}
            {analysis.gaps?.zeroVisibility && analysis.gaps.zeroVisibility.length > 0 && (
              <div>
                <div className="flex items-center gap-2 cursor-pointer mb-3" onClick={() => setGapsExpanded(!gapsExpanded)}>
                  {gapsExpanded ? <ChevronDown className="h-4 w-4" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />}
                  <h2 className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    Posts sem Tráfego no Google ({analysis.gaps.zeroVisibility.length})
                  </h2>
                </div>
                {gapsExpanded && (
                  <div className="glass-card overflow-hidden">
                    {analysis.gaps.zeroVisibility.map((url, i) => {
                      const slug = url.split("/").filter(Boolean).pop() || url;
                      return (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--glass-hover)]"
                          style={{ borderBottom: i < analysis.gaps!.zeroVisibility.length - 1 ? "1px solid var(--glass-border)" : "none" }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{slug}</p>
                            <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{url}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-yellow-600/15 px-2 py-0.5 text-[9px] font-medium text-yellow-400">Verificar indexação</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Zone 4: AI button (disabled) */}
            <div className="glass-card flex items-center justify-between p-4 opacity-60">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Análise avançada com IA (clustering semântico, GEO score, diagnóstico)
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
                Temporariamente indisponível
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
