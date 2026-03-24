"use client";

import { useState } from "react";
import { Search, AlertTriangle, AlertCircle, Info, CheckCircle, ArrowRight } from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { AnalysisLoading } from "@/components/ui/loading";
import { cn, getScoreColor, getScoreBg } from "@/lib/utils";
import type { SEOAnalysis } from "@/types/seo";

export default function AuditPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<SEOAnalysis | null>(null);
  const [error, setError] = useState("");

  const handleAudit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setAnalysis(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data.analysis);
    } catch {
      setError("Erro ao realizar a auditoria. Verifique a URL e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-seo-red" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-seo-orange" />;
      default: return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      excellent: "bg-seo-green/10 text-seo-green",
      good: "bg-seo-yellow/10 text-seo-yellow",
      needs_improvement: "bg-seo-orange/10 text-seo-orange",
      critical: "bg-seo-red/10 text-seo-red",
    };
    const labels: Record<string, string> = {
      excellent: "Excelente",
      good: "Bom",
      needs_improvement: "Precisa Melhorar",
      critical: "Crítico",
    };
    return (
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", styles[status] || "bg-white/5 text-white/30")}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Auditoria SEO</h1>
        <p className="text-sm text-white/40">
          Análise completa de SEO On-Page, Técnico, Conteúdo, Backlinks e UX
        </p>
      </div>

      {/* URL Input */}
      <div className="glass-card flex items-center gap-3 p-4">
        <Search className="h-5 w-5 shrink-0 text-white/30" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAudit()}
          placeholder="Digite a URL para auditar (ex: https://example.com)"
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          onClick={handleAudit}
          disabled={!url.trim() || loading}
          className="btn-primary flex items-center gap-2 px-5 disabled:opacity-30"
        >
          <Search className="h-4 w-4" />
          Auditar
        </button>
      </div>

      {error && (
        <div className="glass-card border-seo-red/20 bg-seo-red/5 p-4">
          <p className="text-sm text-seo-red">{error}</p>
        </div>
      )}

      {loading && <AnalysisLoading />}

      {/* Results */}
      {analysis && !loading && (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="glass-card flex items-center gap-8 p-6">
            <ScoreRing score={analysis.score || 0} size="lg" showLabel />
            <div className="flex-1">
              <h2 className="mb-1 text-lg font-bold text-white">{analysis.url}</h2>
              <p className="text-sm text-white/50">{analysis.summary}</p>
              <p className="mt-2 text-xs text-white/30">
                Analisado em: {new Date(analysis.timestamp || Date.now()).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Categories */}
          {analysis.categories && analysis.categories.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {analysis.categories.map((cat) => (
                <div key={cat.name} className="glass-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-2 w-2 rounded-full", getScoreBg(cat.score))} />
                      <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", getScoreColor(cat.score))}>
                        {cat.score}
                      </span>
                      {statusBadge(cat.status)}
                    </div>
                  </div>

                  {/* Issues */}
                  {cat.issues && cat.issues.length > 0 && (
                    <div className="space-y-2">
                      {cat.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="rounded-lg bg-white/[0.03] p-3"
                        >
                          <div className="mb-1 flex items-center gap-2">
                            {severityIcon(issue.severity)}
                            <span className="text-xs font-medium text-white">{issue.title}</span>
                            <span className={cn(
                              "ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium",
                              `severity-${issue.severity}`
                            )}>
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-xs text-white/40">{issue.description}</p>
                          {issue.howToFix && (
                            <p className="mt-1 text-xs text-brand-400">
                              <ArrowRight className="mr-1 inline h-3 w-3" />
                              {issue.howToFix}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-white">
                <CheckCircle className="mr-2 inline h-4 w-4 text-brand-400" />
                Recomendações Priorizadas
              </h3>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, i) => {
                  const priorityColors: Record<string, string> = {
                    high: "border-l-seo-red bg-seo-red/5",
                    medium: "border-l-seo-orange bg-seo-orange/5",
                    low: "border-l-seo-green bg-seo-green/5",
                  };
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border-l-2 p-4",
                        priorityColors[rec.priority] || "border-l-white/10"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{rec.title}</span>
                        <span className="text-[10px] text-white/30">{rec.category}</span>
                      </div>
                      <p className="text-xs text-white/50">{rec.description}</p>
                      {rec.estimatedImpact && (
                        <p className="mt-1 text-[10px] text-brand-400">
                          Impacto estimado: {rec.estimatedImpact}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
