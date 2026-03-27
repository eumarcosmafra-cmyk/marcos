"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Loader2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  MousePointerClick,
  LayoutGrid,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Sparkles,
  Globe,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryNode {
  id: string;
  name: string;
  url: string;
  topQuery: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  status: "well_positioned" | "opportunity" | "critical";
  score: number;
  priorityScore?: number;
}

interface ApiResponse {
  categories: CategoryNode[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  well_positioned: {
    label: "Top 5",
    bg: "bg-emerald-600/15",
    text: "text-emerald-400",
    color: "rgb(52, 211, 153)",
    bgBlock: "rgba(52, 211, 153, 0.15)",
    borderBlock: "rgba(52, 211, 153, 0.3)",
  },
  opportunity: {
    label: "Oportunidade",
    bg: "bg-yellow-600/15",
    text: "text-yellow-400",
    color: "rgb(251, 191, 36)",
    bgBlock: "rgba(251, 191, 36, 0.15)",
    borderBlock: "rgba(251, 191, 36, 0.3)",
  },
  critical: {
    label: "Critico",
    bg: "bg-red-600/15",
    text: "text-red-400",
    color: "rgb(248, 113, 113)",
    bgBlock: "rgba(248, 113, 113, 0.12)",
    borderBlock: "rgba(248, 113, 113, 0.25)",
  },
} as const;

// ---------------------------------------------------------------------------
// Diagnosis
// ---------------------------------------------------------------------------

function getDiagnosis(cat: CategoryNode): string {
  if (cat.status === "well_positioned") {
    return `Categoria consolidada na posicao ${cat.position.toFixed(1)} para "${cat.topQuery}". Prioridade baixa de correcao -- foco em manter e proteger.`;
  }
  if (cat.status === "opportunity") {
    if (cat.position <= 10) {
      return `Na borda do Top 10 (posicao ${cat.position.toFixed(1)}) com ${cat.impressions.toLocaleString("pt-BR")} impressoes. Otimizacao de title tag e conteudo pode gerar ganho rapido.`;
    }
    return `Forte potencial: ${cat.impressions.toLocaleString("pt-BR")} impressoes na posicao ${cat.position.toFixed(1)}. Demanda existe, URL precisa subir na SERP.`;
  }
  if (cat.impressions >= 100) {
    return `Baixa competitividade (posicao ${cat.position.toFixed(1)}) com ${cat.impressions.toLocaleString("pt-BR")} impressoes. Volume existe, mas a pagina nao compete.`;
  }
  return `Tracao minima -- ${cat.impressions} impressoes. Avaliar se vale investimento ou consolidacao.`;
}

// ---------------------------------------------------------------------------
// Treemap component
// ---------------------------------------------------------------------------

function Treemap({
  categories,
  onSelect,
}: {
  categories: CategoryNode[];
  onSelect: (c: CategoryNode) => void;
}) {
  const maxImpressions = Math.max(...categories.map((c) => c.impressions), 1);

  return (
    <div className="flex flex-wrap gap-1.5" style={{ minHeight: "320px" }}>
      {categories.map((cat) => {
        const relativeSize = Math.max(1, (cat.impressions / maxImpressions) * 100);
        const cfg = STATUS_CONFIG[cat.status];

        return (
          <div
            key={cat.id}
            onClick={() => onSelect(cat)}
            className="group relative flex cursor-pointer flex-col rounded-lg p-3 transition-all hover:scale-[1.02] hover:shadow-lg"
            style={{
              flexGrow: relativeSize,
              flexBasis: `${Math.max(120, relativeSize * 2)}px`,
              minHeight: `${Math.max(80, relativeSize)}px`,
              background: cfg.bgBlock,
              border: `1px solid ${cfg.borderBlock}`,
            }}
          >
            <p
              className="text-xs font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {cat.name}
            </p>
            <p
              className="text-[10px] mt-0.5 truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {cat.topQuery}
            </p>
            <div className="mt-auto flex items-end justify-between pt-2">
              <span className="text-lg font-bold" style={{ color: cfg.color }}>
                {cat.position.toFixed(1)}
              </span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {cat.impressions.toLocaleString("pt-BR")} imp
              </span>
            </div>

            {/* Hover tooltip */}
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 scale-95 rounded-lg p-3 opacity-0 shadow-xl transition-all group-hover:scale-100 group-hover:opacity-100"
              style={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                backdropFilter: "blur(12px)",
                minWidth: "200px",
              }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {cat.name}
              </p>
              <div className="mt-1.5 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: "var(--text-muted)" }}>Posicao</span>
                  <span style={{ color: "var(--text-primary)" }}>{cat.position.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: "var(--text-muted)" }}>Impressoes</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {cat.impressions.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: "var(--text-muted)" }}>Cliques</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {cat.clicks.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: "var(--text-muted)" }}>CTR</span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {(cat.ctr * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", cfg.bg, cfg.text)}>
                  {cfg.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------

function DetailDrawer({
  category,
  onClose,
}: {
  category: CategoryNode | null;
  onClose: () => void;
}) {
  if (!category) return null;
  const cfg = STATUS_CONFIG[category.status];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col overflow-y-auto"
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
              {category.name}
            </h3>
            <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
              {category.url}
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
          {/* Status & Score */}
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full px-3 py-1 text-xs font-medium", cfg.bg, cfg.text)}>
              {cfg.label}
            </span>
            <span
              className="rounded-full bg-brand-600/15 px-3 py-1 text-xs font-bold text-brand-400"
            >
              Score {category.score}
            </span>
          </div>

          {/* Top Query */}
          <div className="glass-card p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Query Principal
            </p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {category.topQuery}
            </p>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Posicao", value: category.position.toFixed(1), icon: TrendingUp, accent: cfg.color },
              { label: "Cliques", value: category.clicks.toLocaleString("pt-BR"), icon: MousePointerClick, accent: "var(--text-primary)" },
              { label: "Impressoes", value: category.impressions.toLocaleString("pt-BR"), icon: Eye, accent: "var(--text-primary)" },
              { label: "CTR", value: `${(category.ctr * 100).toFixed(1)}%`, icon: TrendingUp, accent: "var(--text-primary)" },
            ].map((m) => (
              <div key={m.label} className="glass-card p-3">
                <div className="flex items-center gap-1.5">
                  <m.icon className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {m.label}
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold" style={{ color: m.accent }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Diagnosis */}
          <div
            className="rounded-lg p-4"
            style={{
              background: cfg.bgBlock,
              border: `1px solid ${cfg.borderBlock}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" style={{ color: cfg.color }} />
              <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                Diagnostico
              </p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {getDiagnosis(category)}
            </p>
          </div>

          {/* URL */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              URL
            </p>
            <a
              href={category.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-400 hover:underline break-all"
            >
              {category.url}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Status badge (shared)
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CategoryNode["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Strategic table
// ---------------------------------------------------------------------------

type SortKey = "name" | "topQuery" | "position" | "impressions" | "clicks" | "ctr" | "status" | "score";

function StrategicTable({
  categories,
  onSelect,
}: {
  categories: CategoryNode[];
  onSelect: (c: CategoryNode) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CategoryNode["status"] | "all">("all");

  const filtered = useMemo(() => {
    let list = [...categories];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.topQuery.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    list.sort((a, b) => {
      let aVal: string | number = a[sortKey] ?? "";
      let bVal: string | number = b[sortKey] ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [categories, search, statusFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "name", label: "Categoria" },
    { key: "topQuery", label: "Query Principal" },
    { key: "position", label: "Posicao", align: "text-right" },
    { key: "impressions", label: "Impressoes", align: "text-right" },
    { key: "clicks", label: "Cliques", align: "text-right" },
    { key: "ctr", label: "CTR", align: "text-right" },
    { key: "status", label: "Status" },
    { key: "score", label: "Score", align: "text-right" },
  ];

  return (
    <div className="glass-card overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Buscar categoria ou query..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-9 pr-3 py-1.5 text-xs"
          />
        </div>

        {/* Status filters */}
        <div className="flex rounded-lg" style={{ border: "1px solid var(--glass-border)" }}>
          {(
            [
              { key: "all", label: "Todos" },
              { key: "well_positioned", label: "Top 5" },
              { key: "opportunity", label: "Oportunidade" },
              { key: "critical", label: "Critico" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-[10px] font-medium transition-colors",
                statusFilter === f.key
                  ? "bg-brand-600 text-white"
                  : "hover:bg-[var(--glass-hover)]"
              )}
              style={statusFilter !== f.key ? { color: "var(--text-muted)" } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "cursor-pointer select-none px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider",
                    col.align || "text-left"
                  )}
                  style={{ color: "var(--text-muted)" }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortAsc ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Nenhuma categoria encontrada
                </td>
              </tr>
            ) : (
              filtered.map((cat) => {
                const cfg = STATUS_CONFIG[cat.status];
                return (
                  <tr
                    key={cat.id}
                    onClick={() => onSelect(cat)}
                    className="cursor-pointer transition-colors hover:bg-[var(--glass-hover)]"
                    style={{ borderBottom: "1px solid var(--glass-border)" }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {cat.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {cat.topQuery}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                        {cat.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {cat.impressions.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {cat.clicks.toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {(cat.ctr * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cat.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                        {cat.score}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card helper
// ---------------------------------------------------------------------------

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
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
      <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CategoryMapPage() {
  // State
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [period, setPeriod] = useState("28d");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Derived KPIs
  const kpis = useMemo(() => {
    const total = categories.length;
    const well = categories.filter((c) => c.status === "well_positioned").length;
    const opp = categories.filter((c) => c.status === "opportunity").length;
    const crit = categories.filter((c) => c.status === "critical").length;
    const impressions = categories.reduce((s, c) => s + c.impressions, 0);
    const clicks = categories.reduce((s, c) => s + c.clicks, 0);
    return { total, well, opp, crit, impressions, clicks };
  }, [categories]);

  // Load data
  async function loadData(useMock: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/category-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useMock,
          sitemapUrl: useMock ? undefined : sitemapUrl,
          siteUrl: selectedSite || undefined,
          period,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        setCategories([]);
        return;
      }
      const cats = (data.categories || []).map((c: any) => ({
        ...c,
        score: c.score ?? c.priorityScore ?? 0,
      }));
      setCategories(cats);
      setLoaded(true);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="flex items-center gap-2 text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              <Map className="h-5 w-5 text-brand-500" />
              Category Performance Map
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Mapa estrategico de categorias com treemap visual, diagnostico automatico e priorizacao
            </p>
          </div>
        </div>

        {/* Controls */}
        <div
          className="glass-card mt-4 flex flex-wrap items-end gap-3 p-4"
        >
          {/* Sitemap URL */}
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Sitemap URL
            </label>
            <div className="relative">
              <Globe
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="url"
                placeholder="https://example.com/sitemap.xml"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                className="input-field w-full pl-9 pr-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Site selector */}
          <div className="w-56">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Site GSC
            </label>
            <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
          </div>

          {/* Period */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Periodo
            </label>
            <div className="flex rounded-lg" style={{ border: "1px solid var(--glass-border)" }}>
              {(["7d", "28d", "3m"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-colors",
                    period === p ? "bg-brand-600 text-white" : "hover:bg-[var(--glass-hover)]"
                  )}
                  style={period !== p ? { color: "var(--text-muted)" } : undefined}
                >
                  {p === "7d" ? "7 dias" : p === "28d" ? "28 dias" : "3 meses"}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => loadData(false)}
              disabled={loading || !sitemapUrl}
              className={cn(
                "btn-primary flex items-center gap-2 px-5 py-2 text-xs font-semibold",
                (loading || !sitemapUrl) && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Analisar
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className={cn(
                "btn-secondary flex items-center gap-2 px-4 py-2 text-xs font-medium",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Demo
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Loading */}
      {/* ------------------------------------------------------------------ */}
      {loading && (
        <div className="glass-card flex items-center justify-center gap-3 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Analisando categorias e posicoes via GSC...
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Empty state */}
      {/* ------------------------------------------------------------------ */}
      {!loading && !loaded && (
        <div className="glass-card flex flex-col items-center gap-3 py-20 text-center">
          <LayoutGrid className="h-10 w-10" style={{ color: "var(--text-faint)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Insira um sitemap ou selecione um site e clique em &quot;Analisar&quot; para gerar o mapa.
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Ou clique em &quot;Demo&quot; para visualizar com dados de exemplo.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards */}
      {/* ------------------------------------------------------------------ */}
      {!loading && loaded && (
        <>
          <div className="grid grid-cols-6 gap-3">
            <KpiCard icon={LayoutGrid} label="Total Categorias" value={kpis.total} accent="text-brand-400" />
            <KpiCard icon={CheckCircle2} label="Bem Posicionadas" value={kpis.well} accent="text-emerald-400" />
            <KpiCard icon={AlertTriangle} label="Oportunidades" value={kpis.opp} accent="text-yellow-400" />
            <KpiCard icon={XCircle} label="Criticas" value={kpis.crit} accent="text-red-400" />
            <KpiCard icon={Eye} label="Total Impressoes" value={kpis.impressions} accent="text-brand-400" />
            <KpiCard icon={MousePointerClick} label="Total Cliques" value={kpis.clicks} accent="text-brand-400" />
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Treemap */}
          {/* -------------------------------------------------------------- */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Mapa de Categorias
              </h2>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Tamanho = impressoes | Cor = status
              </span>
            </div>
            <div className="glass-card p-4">
              <Treemap categories={categories} onSelect={setSelectedCategory} />
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Strategic Table */}
          {/* -------------------------------------------------------------- */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Tabela Estrategica
            </h2>
            <StrategicTable categories={categories} onSelect={setSelectedCategory} />
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Detail Drawer */}
      {/* ------------------------------------------------------------------ */}
      <DetailDrawer
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
      />
    </div>
  );
}
