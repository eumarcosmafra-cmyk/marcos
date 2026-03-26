"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Search,
  TrendingUp,
  Zap,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";

interface Opportunity {
  query: string;
  pageUrl: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  sourceType: string;
  demandScore: number;
  probabilityGain: number;
  businessValue: number;
  totalScore: number;
}

interface SerpResult {
  position: number;
  domain: string;
  url: string;
  title: string;
  snippet: string;
  titlePattern: string;
  estimatedFreshness: string;
}

interface SerpAnalysis {
  dominantType: string;
  features: {
    hasFeaturedSnippet: boolean;
    hasPeopleAlsoAsk: boolean;
    paaQuestions: string[];
    hasKnowledgePanel: boolean;
    relatedSearches: string[];
  };
  top5: SerpResult[];
  competitorWeaknesses: string[];
}

interface ContentBrief {
  titleSuggestions: string[];
  recommendedFormat: string;
  wordCountTarget: number;
  keyTopics: string[];
  uniqueAngle: string;
  noveltyScore: number;
  duplicationRisk: number;
  headingStructure: string[];
  paaToTarget: string[];
  internalLinkingSuggestions: string[];
}

interface AnalysisResult {
  serpAnalysis: SerpAnalysis;
  contentBrief: ContentBrief | null;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  quick_win: { label: "Quick Win", color: "bg-emerald-600/20 text-emerald-400" },
  striking_distance: { label: "Striking Distance", color: "bg-yellow-600/20 text-yellow-400" },
  content_gap: { label: "Content Gap", color: "bg-brand-600/20 text-brand-400" },
  weak_serp: { label: "SERP Fraca", color: "bg-purple-600/20 text-purple-400" },
};

export default function ContentOpportunitiesPage() {
  const { data: session } = useSession();
  const [selectedSite, setSelectedSite] = useState("");
  const [period, setPeriod] = useState("28d");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [analyzingQuery, setAnalyzingQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken || !selectedSite) return;
    loadOpportunities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSite, period, session?.accessToken]);

  async function loadOpportunities() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (selectedSite) params.set("siteUrl", selectedSite);
      const res = await fetch(`/api/opportunities/content?${params}`);
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeOpportunity(opp: Opportunity) {
    setAnalyzingQuery(opp.query);
    setExpandedRow(opp.query);
    try {
      const domain = selectedSite
        .replace("sc-domain:", "")
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "");

      const res = await fetch("/api/opportunities/content/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: opp.query,
          clientDomain: domain,
          pageUrl: opp.pageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setAnalyses((prev) => ({ ...prev, [opp.query]: data }));
    } catch {
      alert("Erro ao analisar oportunidade");
    } finally {
      setAnalyzingQuery(null);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
  }

  const totalScore = opportunities.reduce((s, o) => s + o.totalScore, 0);
  const quickWins = opportunities.filter((o) => o.sourceType === "quick_win").length;
  const gaps = opportunities.filter((o) => o.sourceType === "content_gap").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            <Zap className="h-5 w-5 text-brand-500" />
            Content Opportunity Engine
          </h1>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Oportunidades de conteúdo com scoring inteligente e briefs gerados por IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
          </div>
          <div className="flex rounded-lg" style={{ border: "1px solid var(--glass-border)" }}>
            {["7d", "28d", "3m"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  period === p
                    ? "bg-brand-600 text-white"
                    : "hover:bg-[var(--glass-hover)]"
                )}
                style={period !== p ? { color: "var(--text-muted)" } : undefined}
              >
                {p === "7d" ? "7 dias" : p === "28d" ? "28 dias" : "3 meses"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-400" />
            <span className="text-2xl font-bold text-brand-400">{opportunities.length}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Oportunidades</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-2xl font-bold text-emerald-400">{quickWins}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Quick Wins</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">{gaps}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Content Gaps</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-400" />
            <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{totalScore.toFixed(0)}</span>
          </div>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Score Total</p>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Detectando oportunidades via GSC...</span>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Search className="h-8 w-8" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {selectedSite ? "Nenhuma oportunidade detectada" : "Selecione um site para começar"}
            </p>
          </div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  {["Query", "Posição", "Impressões", "CTR", "Score", "Tipo", "Ação"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium uppercase" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => {
                  const isExpanded = expandedRow === opp.query;
                  const analysis = analyses[opp.query];
                  const isAnalyzing = analyzingQuery === opp.query;
                  const source = SOURCE_LABELS[opp.sourceType] || { label: opp.sourceType, color: "bg-white/10 text-white/50" };

                  return (
                    <tr key={opp.query}>
                      <td colSpan={7} className="p-0">
                        <div>
                          {/* Main row */}
                          <div
                            className="flex cursor-pointer items-center transition-colors hover:bg-[var(--glass-hover)]"
                            style={{ borderBottom: "1px solid var(--glass-border)" }}
                            onClick={() => setExpandedRow(isExpanded ? null : opp.query)}
                          >
                            <div className="flex-1 px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isExpanded ? <ChevronUp className="h-3 w-3" style={{ color: "var(--text-muted)" }} /> : <ChevronDown className="h-3 w-3" style={{ color: "var(--text-muted)" }} />}
                                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{opp.query}</span>
                              </div>
                              {opp.pageUrl && (
                                <p className="ml-5 truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{opp.pageUrl}</p>
                              )}
                            </div>
                            <div className="w-20 px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                              {opp.position.toFixed(1)}
                            </div>
                            <div className="w-24 px-4 py-3 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                              {opp.impressions.toLocaleString("pt-BR")}
                            </div>
                            <div className="w-20 px-4 py-3 text-right text-xs" style={{ color: "var(--text-secondary)" }}>
                              {(opp.ctr * 100).toFixed(1)}%
                            </div>
                            <div className="w-20 px-4 py-3 text-right">
                              <span className="rounded-full bg-brand-600/20 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                                {opp.totalScore.toFixed(1)}
                              </span>
                            </div>
                            <div className="w-32 px-4 py-3">
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", source.color)}>
                                {source.label}
                              </span>
                            </div>
                            <div className="w-28 px-4 py-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  analyzeOpportunity(opp);
                                }}
                                disabled={isAnalyzing}
                                className="btn-primary flex items-center gap-1 px-2.5 py-1 text-[10px]"
                              >
                                {isAnalyzing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : analysis ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <Search className="h-3 w-3" />
                                )}
                                {isAnalyzing ? "..." : analysis ? "Ver" : "Analisar"}
                              </button>
                            </div>
                          </div>

                          {/* Expanded analysis */}
                          {isExpanded && (
                            <div className="space-y-4 px-6 py-4" style={{ background: "var(--glass-bg)", borderBottom: "1px solid var(--glass-border)" }}>
                              {isAnalyzing && (
                                <div className="flex items-center gap-2 py-8">
                                  <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Analisando SERP e gerando brief com IA...</span>
                                </div>
                              )}

                              {!isAnalyzing && !analysis && (
                                <div className="flex flex-col items-center gap-2 py-8">
                                  <Search className="h-6 w-6" style={{ color: "var(--text-faint)" }} />
                                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                    Clique em &quot;Analisar&quot; para ver a análise da SERP e o brief de conteúdo
                                  </p>
                                </div>
                              )}

                              {analysis && (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* SERP Analysis */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                      Análise da SERP
                                    </h4>

                                    {/* Top 5 */}
                                    <div className="space-y-1">
                                      {analysis.serpAnalysis.top5.map((r) => (
                                        <div key={r.url} className="flex items-center gap-2 rounded p-1.5 bg-white/[0.02]">
                                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold" style={{ color: "var(--text-primary)" }}>
                                            {r.position}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                                            <p className="truncate text-[9px]" style={{ color: "var(--text-muted)" }}>{r.domain}</p>
                                          </div>
                                          <span className="shrink-0 text-[9px]" style={{ color: "var(--text-muted)" }}>{r.titlePattern}</span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Features */}
                                    <div className="flex flex-wrap gap-1">
                                      {analysis.serpAnalysis.features.hasFeaturedSnippet && (
                                        <span className="rounded bg-yellow-600/20 px-1.5 py-0.5 text-[9px] text-yellow-400">Featured Snippet</span>
                                      )}
                                      {analysis.serpAnalysis.features.hasPeopleAlsoAsk && (
                                        <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[9px] text-blue-400">PAA ({analysis.serpAnalysis.features.paaQuestions.length})</span>
                                      )}
                                      {analysis.serpAnalysis.features.hasKnowledgePanel && (
                                        <span className="rounded bg-purple-600/20 px-1.5 py-0.5 text-[9px] text-purple-400">Knowledge Panel</span>
                                      )}
                                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                                        Tipo: {analysis.serpAnalysis.dominantType}
                                      </span>
                                    </div>

                                    {/* Weaknesses */}
                                    {analysis.serpAnalysis.competitorWeaknesses.length > 0 && (
                                      <div>
                                        <p className="mb-1 text-[10px] font-medium text-yellow-400">Fraquezas dos concorrentes:</p>
                                        {analysis.serpAnalysis.competitorWeaknesses.map((w, i) => (
                                          <p key={i} className="text-[10px]" style={{ color: "var(--text-secondary)" }}>• {w}</p>
                                        ))}
                                      </div>
                                    )}

                                    {/* PAA Questions */}
                                    {analysis.serpAnalysis.features.paaQuestions.length > 0 && (
                                      <div>
                                        <p className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>People Also Ask:</p>
                                        {analysis.serpAnalysis.features.paaQuestions.map((q, i) => (
                                          <p key={i} className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>• {q}</p>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Content Brief */}
                                  {analysis.contentBrief && (
                                    <div className="space-y-3">
                                      <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                                        Brief de Conteúdo (IA)
                                      </h4>

                                      {/* Titles */}
                                      <div>
                                        <p className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Títulos sugeridos:</p>
                                        {analysis.contentBrief.titleSuggestions.map((t, i) => (
                                          <div key={i} className="group flex items-center gap-1.5 rounded p-1 hover:bg-[var(--glass-hover)]">
                                            <p className="flex-1 text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{t}</p>
                                            <button onClick={() => copyText(t)} className="opacity-0 group-hover:opacity-100">
                                              <Copy className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Format & Word count */}
                                      <div className="flex gap-2">
                                        <span className="rounded bg-brand-600/20 px-2 py-0.5 text-[10px] text-brand-400">
                                          {analysis.contentBrief.recommendedFormat}
                                        </span>
                                        <span className="rounded bg-white/10 px-2 py-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                          ~{analysis.contentBrief.wordCountTarget} palavras
                                        </span>
                                      </div>

                                      {/* Unique Angle */}
                                      <div className="rounded-lg bg-emerald-600/10 p-2.5">
                                        <p className="mb-0.5 text-[10px] font-semibold text-emerald-400">Ângulo Único (Information Gain):</p>
                                        <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{analysis.contentBrief.uniqueAngle}</p>
                                      </div>

                                      {/* Scores */}
                                      <div className="flex gap-3">
                                        <div>
                                          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Novidade</p>
                                          <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${analysis.contentBrief.noveltyScore * 100}%` }} />
                                            </div>
                                            <span className="text-[9px] text-emerald-400">{(analysis.contentBrief.noveltyScore * 100).toFixed(0)}%</span>
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>Risco Duplicação</p>
                                          <div className="flex items-center gap-1">
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                                              <div className="h-full rounded-full bg-red-500" style={{ width: `${analysis.contentBrief.duplicationRisk * 100}%` }} />
                                            </div>
                                            <span className="text-[9px] text-red-400">{(analysis.contentBrief.duplicationRisk * 100).toFixed(0)}%</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Heading Structure */}
                                      <div>
                                        <p className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Estrutura:</p>
                                        {analysis.contentBrief.headingStructure.map((h, i) => (
                                          <p key={i} className="text-[10px]" style={{ color: "var(--text-tertiary)", paddingLeft: h.startsWith("H3") ? "12px" : "0" }}>
                                            {h}
                                          </p>
                                        ))}
                                      </div>

                                      {/* Key Topics */}
                                      <div>
                                        <p className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Tópicos-chave:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {analysis.contentBrief.keyTopics.map((t, i) => (
                                            <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px]" style={{ color: "var(--text-secondary)" }}>{t}</span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
