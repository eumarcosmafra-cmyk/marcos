"use client";

import { useState } from "react";
import {
  FileText,
  Download,
  Globe,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { AnalysisLoading } from "@/components/ui/loading";

export default function ReportsPage() {
  const [clientName, setClientName] = useState("");
  const [domain, setDomain] = useState("");
  const [score, setScore] = useState("");
  const [type, setType] = useState("completa");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [generatedReports, setGeneratedReports] = useState<
    { clientName: string; domain: string; type: string; date: string; content: string }[]
  >([]);

  const handleGenerate = async () => {
    if (!clientName.trim() || !domain.trim()) return;
    setLoading(true);
    setError("");
    setReport("");

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          domain: domain.trim(),
          score: parseInt(score) || 0,
          type,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data.report);
      setGeneratedReports((prev) => [
        {
          clientName: clientName.trim(),
          domain: domain.trim(),
          type,
          date: new Date().toISOString(),
          content: data.report,
        },
        ...prev,
      ]);
    } catch {
      setError("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Relatórios</h1>
        <p className="text-sm text-white/40">
          Gere relatórios profissionais de SEO para seus clientes
        </p>
      </div>

      {/* Generate Form */}
      <div className="glass-card space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-brand-400" />
          Gerar Novo Relatório
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/40">Nome do Cliente</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ex: Empresa XYZ"
                className="input-field pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Domínio</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Ex: empresaxyz.com.br"
                className="input-field pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Score Atual (0-100)</label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Ex: 65"
              min="0"
              max="100"
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/40">Tipo de Análise</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input-field"
            >
              <option value="completa">Análise Completa</option>
              <option value="on-page">SEO On-Page</option>
              <option value="tecnica">SEO Técnico</option>
              <option value="conteudo">Conteúdo</option>
              <option value="backlinks">Backlinks</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!clientName.trim() || !domain.trim() || loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-30"
        >
          <FileText className="h-4 w-4" />
          Gerar Relatório
        </button>
      </div>

      {error && (
        <div className="glass-card border-seo-red/20 bg-seo-red/5 p-4">
          <p className="text-sm text-seo-red">{error}</p>
        </div>
      )}

      {loading && <AnalysisLoading />}

      {/* Current Report */}
      {report && !loading && (
        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Relatório: {clientName}
            </h3>
            <button
              onClick={() => handleCopy(report)}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <Download className="h-3 w-3" />
              Copiar
            </button>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-6">
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                {report}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Report History */}
      {generatedReports.length > 0 && !report && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Relatórios Gerados</h3>
          <div className="space-y-2">
            {generatedReports.map((r, i) => (
              <div
                key={i}
                className="glass-card-hover flex cursor-pointer items-center justify-between p-4"
                onClick={() => setReport(r.content)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-brand-400" />
                  <div>
                    <p className="text-sm font-medium text-white">{r.clientName}</p>
                    <p className="text-xs text-white/30">
                      {r.domain} • {r.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <Clock className="h-3 w-3" />
                  {new Date(r.date).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
