"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parseGA4CSV, type ParseResult } from "@/lib/ga4/csv-parser";

interface CsvUploadProps {
  onParsed: (result: ParseResult) => void;
}

export function CsvUpload({ onParsed }: CsvUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseGA4CSV(text);
      setResult(parsed);
      onParsed(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao parsear CSV");
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
    else setError("Apenas arquivos .csv são aceitos");
  }, [handleFile]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (result) {
    const formatLabel = result.format === "format_b" ? "Export completo com categoria" : "Export por nome do item (inferência)";
    return (
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {result.products.length} produtos carregados
          </p>
          <span className="rounded-full bg-brand-600/15 px-2 py-0.5 text-[9px] text-brand-400">{formatLabel}</span>
        </div>

        {result.warnings.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />
            <p className="text-[10px] text-yellow-400">{w}</p>
          </div>
        ))}

        {/* Preview */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                {["Produto", "Categoria", "Receita", "Vendidos", "Views"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-[9px] font-medium uppercase" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.products.slice(0, 5).map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <td className="px-2 py-1.5 text-[10px]" style={{ color: "var(--text-primary)" }}>{p.name}</td>
                  <td className="px-2 py-1.5">
                    <span className={`text-[9px] rounded-full px-1.5 py-0.5 ${p.categorySource === "ga4" ? "bg-emerald-600/15 text-emerald-400" : "bg-yellow-600/15 text-yellow-400"}`}>
                      {p.category}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[10px] text-right" style={{ color: "var(--text-secondary)" }}>R$ {p.revenue.toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-1.5 text-[10px] text-right" style={{ color: "var(--text-secondary)" }}>{p.unitsSold}</td>
                  <td className="px-2 py-1.5 text-[10px] text-right" style={{ color: "var(--text-secondary)" }}>{p.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.products.length > 5 && (
            <p className="text-[9px] px-2 py-1" style={{ color: "var(--text-muted)" }}>...e mais {result.products.length - 5} produtos</p>
          )}
        </div>

        <button onClick={() => { setResult(null); setError(null); }} className="text-[10px] text-brand-400 hover:underline">
          Carregar outro arquivo
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className="glass-card flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-all"
        style={{ border: `2px dashed ${dragging ? "var(--brand-primary)" : "var(--glass-border)"}` }}
        onClick={() => document.getElementById("csv-input")?.click()}
      >
        <Upload className="h-8 w-8" style={{ color: dragging ? "var(--brand-primary)" : "var(--text-muted)" }} />
        <div className="text-center">
          <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            Arraste o export do GA4 aqui
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            ou clique para selecionar (.csv)
          </p>
        </div>
        <div className="flex gap-4 mt-2">
          <div className="text-center">
            <FileText className="h-3 w-3 mx-auto mb-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Format A: Compras por item</p>
          </div>
          <div className="text-center">
            <FileText className="h-3 w-3 mx-auto mb-0.5" style={{ color: "var(--text-muted)" }} />
            <p className="text-[8px]" style={{ color: "var(--text-muted)" }}>Format B: Explorar com categoria</p>
          </div>
        </div>
        <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleInput} />
      </div>
      {error && (
        <p className="text-[10px] text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
