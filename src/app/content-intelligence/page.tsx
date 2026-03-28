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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClusterUrl {
  url: string;
  title: string;
  tipo_intencao: string;
}

interface Cluster {
  nome_cluster: string;
  entidade_principal: string;
  score: "forte" | "medio" | "fraco";
  total_urls: number;
  urls: ClusterUrl[];
  metricas: { impressoes: number; cliques: number; ctr_medio: number };
  cobertura: { atual: number; ideal: number; gap: number };
  diagnostico: string;
  oportunidades: string[];
}

interface Analysis {
  clusters: Cluster[];
  priorizacao: { cluster: string; motivo: string }[];
  resumo: {
    total_urls: number;
    total_clusters: number;
    clusters_fortes: number;
    clusters_medios: number;
    clusters_fracos: number;
  };
}

// ---------------------------------------------------------------------------
// Score config
// ---------------------------------------------------------------------------

const SCORE_CONFIG = {
  forte: {
    label: "Forte",
    bg: "bg-emerald-600/15",
    text: "text-emerald-400",
    color: "rgb(52, 211, 153)",
    bgBlock: "rgba(52, 211, 153, 0.12)",
    borderBlock: "rgba(52, 211, 153, 0.25)",
    borderLeft: "rgb(52, 211, 153)",
  },
  medio: {
    label: "Medio",
    bg: "bg-yellow-600/15",
    text: "text-yellow-400",
    color: "rgb(251, 191, 36)",
    bgBlock: "rgba(251, 191, 36, 0.12)",
    borderBlock: "rgba(251, 191, 36, 0.25)",
    borderLeft: "rgb(251, 191, 36)",
  },
  fraco: {
    label: "Fraco",
    bg: "bg-red-600/15",
    text: "text-red-400",
    color: "rgb(248, 113, 113)",
    bgBlock: "rgba(248, 113, 113, 0.12)",
    borderBlock: "rgba(248, 113, 113, 0.25)",
    borderLeft: "rgb(248, 113, 113)",
  },
} as const;

const INTENTION_CONFIG: Record<string, { bg: string; text: string }> = {
  informacional: { bg: "bg-blue-600/15", text: "text-blue-400" },
  comercial: { bg: "bg-purple-600/15", text: "text-purple-400" },
  transacional: { bg: "bg-emerald-600/15", text: "text-emerald-400" },
  navegacional: { bg: "bg-gray-600/15", text: "text-gray-400" },
};

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
  value: number;
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
        {value.toLocaleString("pt-BR")}
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
// Score Badge
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: "forte" | "medio" | "fraco" }) {
  const cfg = SCORE_CONFIG[score];
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
// Cluster Card
// ---------------------------------------------------------------------------

function ClusterCard({
  cluster,
  onOpenDrawer,
}: {
  cluster: Cluster;
  onOpenDrawer: (c: Cluster) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SCORE_CONFIG[cluster.score];

  return (
    <div
      className="glass-card overflow-hidden transition-all"
      style={{ borderLeft: `3px solid ${cfg.borderLeft}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {cluster.nome_cluster}
              </h3>
              <span className="rounded-full bg-brand-600/15 px-2 py-0.5 text-[10px] font-medium text-brand-400">
                {cluster.entidade_principal}
              </span>
              <ScoreBadge score={cluster.score} />
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {cluster.total_urls} URLs | {cluster.metricas.impressoes.toLocaleString("pt-BR")} impressoes | {cluster.metricas.cliques.toLocaleString("pt-BR")} cliques
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrawer(cluster);
          }}
          className="ml-3 flex-shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--glass-hover)]"
          style={{ color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
        >
          Detalhes
        </button>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { label: "Impressoes", value: cluster.metricas.impressoes.toLocaleString("pt-BR"), icon: Eye },
              { label: "Cliques", value: cluster.metricas.cliques.toLocaleString("pt-BR"), icon: MousePointerClick },
              { label: "CTR Medio", value: `${(cluster.metricas.ctr_medio * 100).toFixed(1)}%`, icon: TrendingUp },
            ].map((m) => (
              <div key={m.label} className="glass-card p-3">
                <div className="flex items-center gap-1.5">
                  <m.icon className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                </div>
                <p className="mt-1 text-sm font-bold" style={{ color: "var(--text-primary)" }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Coverage bar */}
          <CoverageBar atual={cluster.cobertura.atual} ideal={cluster.cobertura.ideal} gap={cluster.cobertura.gap} />

          {/* URLs list */}
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

          {/* Opportunities */}
          {cluster.oportunidades.length > 0 && (
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

          {/* Diagnostic */}
          <div
            className="rounded-lg p-3"
            style={{ background: cfg.bgBlock, border: `1px solid ${cfg.borderBlock}` }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: cfg.color }}>
              Diagnostico
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {cluster.diagnostico}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer
// ---------------------------------------------------------------------------

function DetailDrawer({
  cluster,
  onClose,
}: {
  cluster: Cluster | null;
  onClose: () => void;
}) {
  if (!cluster) return null;
  const cfg = SCORE_CONFIG[cluster.score];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col overflow-y-auto"
        style={{
          background: "var(--glass-bg)",
          borderLeft: "1px solid var(--glass-border)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--glass-border)" }}
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
              {cluster.nome_cluster}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {cluster.entidade_principal} | {cluster.total_urls} URLs
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-lg p-1.5 transition-colors hover:bg-[var(--glass-hover)]"
          >
            <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 px-6 py-5">
          {/* Score & Entity */}
          <div className="flex items-center gap-3">
            <ScoreBadge score={cluster.score} />
            <span className="rounded-full bg-brand-600/15 px-3 py-1 text-xs font-medium text-brand-400">
              {cluster.entidade_principal}
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Impressoes", value: cluster.metricas.impressoes.toLocaleString("pt-BR"), icon: Eye, accent: "var(--text-primary)" },
              { label: "Cliques", value: cluster.metricas.cliques.toLocaleString("pt-BR"), icon: MousePointerClick, accent: "var(--text-primary)" },
              { label: "CTR Medio", value: `${(cluster.metricas.ctr_medio * 100).toFixed(1)}%`, icon: TrendingUp, accent: "var(--text-primary)" },
              { label: "Total URLs", value: cluster.total_urls.toString(), icon: FileText, accent: cfg.color },
            ].map((m) => (
              <div key={m.label} className="glass-card p-3">
                <div className="flex items-center gap-1.5">
                  <m.icon className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold" style={{ color: m.accent }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Coverage */}
          <div className="glass-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Cobertura de Conteudo
            </p>
            <CoverageBar atual={cluster.cobertura.atual} ideal={cluster.cobertura.ideal} gap={cluster.cobertura.gap} />
          </div>

          {/* Diagnostic */}
          <div
            className="rounded-lg p-4"
            style={{ background: cfg.bgBlock, border: `1px solid ${cfg.borderBlock}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              {cluster.score === "forte" ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: cfg.color }} />
              ) : (
                <AlertTriangle className="h-4 w-4" style={{ color: cfg.color }} />
              )}
              <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                Diagnostico
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {cluster.diagnostico}
            </p>
          </div>

          {/* Opportunities */}
          {cluster.oportunidades.length > 0 && (
            <div className="glass-card p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Oportunidades de Conteudo
              </p>
              <ul className="space-y-2">
                {cluster.oportunidades.map((op, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                    {op}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* URLs */}
          <div className="glass-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              URLs do Cluster ({cluster.urls.length})
            </p>
            <div className="space-y-2">
              {cluster.urls.map((u, i) => (
                <div
                  key={i}
                  className="rounded-lg p-3"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {u.title || u.url}
                    </p>
                    <IntentionBadge tipo={u.tipo_intencao} />
                  </div>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] mt-1 block truncate hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {u.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Priority List
// ---------------------------------------------------------------------------

function PriorityList({ items }: { items: { cluster: string; motivo: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const borderColor =
          i < items.length * 0.33
            ? "rgb(248, 113, 113)"
            : i < items.length * 0.66
            ? "rgb(251, 191, 36)"
            : "rgb(52, 211, 153)";

        return (
          <div
            key={i}
            className="glass-card flex items-start gap-3 p-3"
            style={{ borderLeft: `3px solid ${borderColor}` }}
          >
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ background: `${borderColor}20`, color: borderColor }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {item.cluster}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {item.motivo}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContentIntelligencePage() {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [period, setPeriod] = useState("last28days");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [drawerCluster, setDrawerCluster] = useState<Cluster | null>(null);
  const [sortOrder, setSortOrder] = useState<"worst" | "best">("worst");

  // Sort clusters
  const sortedClusters = useMemo(() => {
    if (!analysis) return [];
    const scoreRank = { fraco: 0, medio: 1, forte: 2 };
    const sorted = [...analysis.clusters].sort((a, b) => scoreRank[a.score] - scoreRank[b.score]);
    return sortOrder === "worst" ? sorted : sorted.reverse();
  }, [analysis, sortOrder]);

  // Run analysis
  async function handleAnalyze() {
    if (!sitemapUrl.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/content-intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitemapUrl: sitemapUrl.trim(),
          siteUrl: selectedSite || undefined,
          period,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const result = data.analysis as Analysis;
      if (!result || !result.clusters) throw new Error("Resposta da IA incompleta");
      setAnalysis(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
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
              Analisando conteudo com IA...
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              Processando sitemap, metricas GSC e gerando clusters (pode levar ate 60s)
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
            {/* Section A: KPI Summary Cards */}
            <div>
              <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                Resumo da Analise
              </h2>
              <div className="grid grid-cols-5 gap-3">
                <KpiCard label="Total URLs" value={analysis.resumo.total_urls} icon={FileText} />
                <KpiCard label="Clusters" value={analysis.resumo.total_clusters} icon={Layers} />
                <KpiCard label="Clusters Fortes" value={analysis.resumo.clusters_fortes} icon={CheckCircle2} accent="rgb(52, 211, 153)" />
                <KpiCard label="Clusters Medios" value={analysis.resumo.clusters_medios} icon={Zap} accent="rgb(251, 191, 36)" />
                <KpiCard label="Clusters Fracos" value={analysis.resumo.clusters_fracos} icon={AlertTriangle} accent="rgb(248, 113, 113)" />
              </div>
            </div>

            {/* Section B: Priorizacao */}
            {analysis.priorizacao.length > 0 && (
              <div>
                <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                  Priorizacao de Clusters
                </h2>
                <PriorityList items={analysis.priorizacao} />
              </div>
            )}

            {/* Section C: Clusters Detail */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  Detalhamento dos Clusters ({sortedClusters.length})
                </h2>
                <button
                  onClick={() => setSortOrder((o) => (o === "worst" ? "best" : "worst"))}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors hover:bg-[var(--glass-hover)]"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--glass-border)" }}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortOrder === "worst" ? "Piores primeiro" : "Melhores primeiro"}
                </button>
              </div>
              <div className="space-y-3">
                {sortedClusters.map((cluster, i) => (
                  <ClusterCard key={i} cluster={cluster} onOpenDrawer={setDrawerCluster} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Section D: Detail Drawer */}
      <DetailDrawer cluster={drawerCluster} onClose={() => setDrawerCluster(null)} />
    </>
  );
}
