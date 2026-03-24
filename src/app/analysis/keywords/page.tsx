"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Target,
  Lightbulb,
  Hash,
  DollarSign,
  BarChart3,
  Layers,
} from "lucide-react";
import { AnalysisLoading } from "@/components/ui/loading";
import { cn, getScoreColor } from "@/lib/utils";

interface KeywordResult {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  trend: string;
  searchIntent?: string;
  relatedKeywords?: string[];
  longTailKeywords?: string[];
  questions?: string[];
  contentSuggestions?: string[];
  topicClusters?: { pillar: string; subtopics: string[] }[];
}

export default function KeywordsPage() {
  const [keyword, setKeyword] = useState("");
  const [niche, setNiche] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!keyword.trim() || !niche.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), niche: niche.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.analysis);
    } catch {
      setError("Erro ao pesquisar keywords. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-seo-green" />;
      case "down": return <TrendingDown className="h-4 w-4 text-seo-red" />;
      default: return <Minus className="h-4 w-4 text-seo-yellow" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Pesquisa de Keywords</h1>
        <p className="text-sm text-white/40">
          Encontre as melhores keywords para seu nicho com análise avançada por IA
        </p>
      </div>

      {/* Search Form */}
      <div className="glass-card space-y-3 p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/40">Keyword principal</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Ex: marketing digital"
                className="input-field pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Nicho / Indústria</label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Ex: agência de marketing"
                className="input-field pl-10"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={!keyword.trim() || !niche.trim() || loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-30"
        >
          <Search className="h-4 w-4" />
          Pesquisar Keywords
        </button>
      </div>

      {error && (
        <div className="glass-card border-seo-red/20 bg-seo-red/5 p-4">
          <p className="text-sm text-seo-red">{error}</p>
        </div>
      )}

      {loading && <AnalysisLoading />}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Main Metrics */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="glass-card p-4 text-center">
              <BarChart3 className="mx-auto mb-2 h-5 w-5 text-white/30" />
              <p className="text-2xl font-bold text-white">
                {(result.volume || 0).toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-white/40">Volume Mensal</p>
            </div>
            <div className="glass-card p-4 text-center">
              <Target className="mx-auto mb-2 h-5 w-5 text-white/30" />
              <p className={cn("text-2xl font-bold", getScoreColor(100 - (result.difficulty || 0)))}>
                {result.difficulty || 0}
              </p>
              <p className="text-xs text-white/40">Dificuldade</p>
            </div>
            <div className="glass-card p-4 text-center">
              <DollarSign className="mx-auto mb-2 h-5 w-5 text-white/30" />
              <p className="text-2xl font-bold text-white">
                R$ {(result.cpc || 0).toFixed(2)}
              </p>
              <p className="text-xs text-white/40">CPC Estimado</p>
            </div>
            <div className="glass-card flex flex-col items-center justify-center p-4">
              {trendIcon(result.trend)}
              <p className="mt-1 text-sm font-semibold text-white capitalize">{result.trend || "stable"}</p>
              <p className="text-xs text-white/40">Tendência</p>
            </div>
          </div>

          {/* Search Intent */}
          {result.searchIntent && (
            <div className="glass-card p-4">
              <h3 className="mb-2 text-xs font-semibold text-white/60">Intenção de Busca</h3>
              <span className="rounded-full bg-brand-600/20 px-3 py-1 text-sm font-medium text-brand-400 capitalize">
                {result.searchIntent}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Related Keywords */}
            {result.relatedKeywords && result.relatedKeywords.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Hash className="h-4 w-4 text-brand-400" />
                  Keywords Relacionadas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.relatedKeywords.map((kw, i) => (
                    <span key={i} className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs text-white/70">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Long Tail Keywords */}
            {result.longTailKeywords && result.longTailKeywords.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <TrendingUp className="h-4 w-4 text-seo-green" />
                  Keywords Long Tail
                </h3>
                <div className="space-y-1.5">
                  {result.longTailKeywords.map((kw, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                      {kw}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions */}
            {result.questions && result.questions.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Lightbulb className="h-4 w-4 text-seo-yellow" />
                  Perguntas Frequentes
                </h3>
                <div className="space-y-1.5">
                  {result.questions.map((q, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Suggestions */}
            {result.contentSuggestions && result.contentSuggestions.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Lightbulb className="h-4 w-4 text-brand-400" />
                  Sugestões de Conteúdo
                </h3>
                <div className="space-y-1.5">
                  {result.contentSuggestions.map((s, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-white/60">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Topic Clusters */}
          {result.topicClusters && result.topicClusters.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Layers className="h-4 w-4 text-brand-400" />
                Topic Clusters
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.topicClusters.map((cluster, i) => (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
                    <h4 className="mb-2 text-xs font-semibold text-brand-400">
                      {cluster.pillar}
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.subtopics.map((sub, j) => (
                        <span key={j} className="rounded bg-white/[0.05] px-2 py-1 text-[10px] text-white/50">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
