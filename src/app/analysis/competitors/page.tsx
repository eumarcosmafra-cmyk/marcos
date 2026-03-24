"use client";

import { useState } from "react";
import {
  Globe,
  Plus,
  X,
  Search,
  Shield,
  AlertTriangle,
  Target,
  FileText,
  Zap,
} from "lucide-react";
import { AnalysisLoading } from "@/components/ui/loading";

interface CompetitorResult {
  domain: string;
  competitors?: { domain: string; strengths: string[]; weaknesses: string[] }[];
  overlapKeywords?: string[];
  opportunities?: string[];
  contentGaps?: string[];
  actionPlan?: string[];
}

export default function CompetitorsPage() {
  const [domain, setDomain] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorResult | null>(null);
  const [error, setError] = useState("");

  const addCompetitor = () => {
    const trimmed = competitorInput.trim();
    if (trimmed && !competitors.includes(trimmed)) {
      setCompetitors([...competitors, trimmed]);
      setCompetitorInput("");
    }
  };

  const removeCompetitor = (c: string) => {
    setCompetitors(competitors.filter((x) => x !== c));
  };

  const handleAnalyze = async () => {
    if (!domain.trim() || competitors.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), competitors }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.analysis);
    } catch {
      setError("Erro ao analisar concorrentes. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Análise de Concorrentes</h1>
        <p className="text-sm text-white/40">
          Compare seu domínio com concorrentes e descubra oportunidades
        </p>
      </div>

      {/* Form */}
      <div className="glass-card space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs text-white/40">Seu domínio</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Ex: meusite.com.br"
              className="input-field pl-10"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-white/40">
            Concorrentes ({competitors.length} adicionado{competitors.length !== 1 ? "s" : ""})
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
                placeholder="Ex: concorrente.com.br"
                className="input-field pl-10"
              />
            </div>
            <button onClick={addCompetitor} className="btn-secondary flex items-center gap-1">
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>
          {competitors.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {competitors.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs text-white/70"
                >
                  {c}
                  <button onClick={() => removeCompetitor(c)} className="text-white/30 hover:text-white/60">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!domain.trim() || competitors.length === 0 || loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-30"
        >
          <Search className="h-4 w-4" />
          Analisar Concorrentes
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
          {/* Competitor Cards */}
          {result.competitors && result.competitors.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {result.competitors.map((comp, i) => (
                <div key={i} className="glass-card p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Globe className="h-4 w-4 text-brand-400" />
                    {comp.domain}
                  </h3>
                  <div className="space-y-3">
                    {comp.strengths.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-seo-green">
                          <Shield className="h-3 w-3" /> Pontos Fortes
                        </h4>
                        <ul className="space-y-1">
                          {comp.strengths.map((s, j) => (
                            <li key={j} className="text-xs text-white/50 pl-4 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-seo-green/50">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {comp.weaknesses.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 flex items-center gap-1 text-xs font-medium text-seo-orange">
                          <AlertTriangle className="h-3 w-3" /> Pontos Fracos
                        </h4>
                        <ul className="space-y-1">
                          {comp.weaknesses.map((w, j) => (
                            <li key={j} className="text-xs text-white/50 pl-4 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-seo-orange/50">
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Overlap Keywords */}
          {result.overlapKeywords && result.overlapKeywords.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4 text-brand-400" />
                Keywords em Comum
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.overlapKeywords.map((kw, i) => (
                  <span key={i} className="rounded-lg bg-brand-600/10 px-3 py-1.5 text-xs text-brand-400">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Opportunities */}
            {result.opportunities && result.opportunities.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Zap className="h-4 w-4 text-seo-green" />
                  Oportunidades
                </h3>
                <div className="space-y-2">
                  {result.opportunities.map((opp, i) => (
                    <div key={i} className="rounded-lg bg-seo-green/5 px-3 py-2 text-xs text-white/60">
                      {opp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Gaps */}
            {result.contentGaps && result.contentGaps.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4 text-seo-orange" />
                  Gaps de Conteúdo
                </h3>
                <div className="space-y-2">
                  {result.contentGaps.map((gap, i) => (
                    <div key={i} className="rounded-lg bg-seo-orange/5 px-3 py-2 text-xs text-white/60">
                      {gap}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Plan */}
          {result.actionPlan && result.actionPlan.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Target className="h-4 w-4 text-brand-400" />
                Plano de Ação
              </h3>
              <div className="space-y-2">
                {result.actionPlan.map((action, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-white/[0.03] px-4 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/20 text-[10px] font-bold text-brand-400">
                      {i + 1}
                    </span>
                    <p className="text-xs text-white/60">{action}</p>
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
