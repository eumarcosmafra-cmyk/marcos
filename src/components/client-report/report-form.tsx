"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";
import type { ClientReport, RankingWin, VisualKeyword, NextStep, FunnelData, AIPlatforms } from "@/types/client-report";

interface Props {
  clientId: string;
  clientDomain?: string;
  onSaved: (report: ClientReport) => void;
  onCancel: () => void;
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--glass-hover)] transition-colors"
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-xs outline-none"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
    />
  );
}

export function ReportForm({ clientId, clientDomain, onSaved, onCancel }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Period
  const [period, setPeriod] = useState("");
  const [periodType, setPeriodType] = useState("trimestral");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [autoFillStatus, setAutoFillStatus] = useState("");

  // Metrics
  const [clicks, setClicks] = useState(0);
  const [clicksDelta, setClicksDelta] = useState(0);
  const [impressions, setImpressions] = useState(0);
  const [impressionsDelta, setImpressionsDelta] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [cartConversion, setCartConversion] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [aiMentions, setAiMentions] = useState(0);

  // Funnel
  const [funnel, setFunnel] = useState<FunnelData>({ itemsViewed: 0, addedToCart: 0, purchased: 0 });

  // Rankings
  const [rankings, setRankings] = useState<RankingWin[]>([]);

  // Visual keywords
  const [visualKws, setVisualKws] = useState<VisualKeyword[]>([]);

  // AI Platforms
  const [aiPlatforms, setAiPlatforms] = useState<AIPlatforms>({ chatgpt: 0, aiMode: 0, gemini: 0, aiOverview: 0 });

  // Next steps
  const [nextSteps, setNextSteps] = useState<NextStep[]>([]);

  // Notes
  const [notes, setNotes] = useState("");

  async function handleFillGSC() {
    if (!periodStart || !periodEnd || !clientDomain) { setAutoFillStatus("Defina datas e domínio primeiro."); return; }
    setAutoFillStatus("Buscando dados do GSC...");
    try {
      const days = Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86400000);
      const prevEnd = new Date(periodStart); prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days);
      const res = await fetch("/api/gsc/period-summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: clientDomain, currentPeriod: { startDate: periodStart, endDate: periodEnd }, previousPeriod: { startDate: prevStart.toISOString().split("T")[0], endDate: prevEnd.toISOString().split("T")[0] } }),
      });
      const data = await res.json();
      if (data.error) { setAutoFillStatus(data.error); return; }
      setClicks(data.current.clicks);
      setClicksDelta(data.deltas.clicks);
      setImpressions(data.current.impressions);
      setImpressionsDelta(data.deltas.impressions);
      setAutoFillStatus("GSC preenchido!");
    } catch (e) { console.error("[report-form] GSC error:", e); setAutoFillStatus("Erro ao buscar GSC."); }
  }

  async function handleFillGA4() {
    if (!periodStart || !periodEnd) { setAutoFillStatus("Defina as datas primeiro."); return; }
    setAutoFillStatus("Buscando dados do GA4...");
    try {
      const res = await fetch("/api/ga4/ecommerce", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, currentPeriod: { startDate: periodStart, endDate: periodEnd } }),
      });
      const data = await res.json();
      if (data.error) { setAutoFillStatus(data.error); return; }
      setRevenue(Math.round(data.data.current.revenue));
      setCartConversion(data.data.current.addedToCart > 0 ? Math.round((data.data.current.itemsPurchased / data.data.current.addedToCart) * 100) : 0);
      setFunnel({ itemsViewed: data.data.current.itemsViewed, addedToCart: data.data.current.addedToCart, purchased: data.data.current.itemsPurchased });
      setAutoFillStatus("GA4 preenchido!");
    } catch (e) { console.error("[report-form] GA4 error:", e); setAutoFillStatus("Erro ao buscar GA4."); }
  }

  useEffect(() => {
    if (!periodStart || !periodEnd) return;
    if (clientDomain) handleFillGSC();
    handleFillGA4();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStart, periodEnd, clientDomain]);

  async function handleSave() {
    if (!period.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period, periodType,
          clicks, clicksDelta, impressions, impressionsDelta,
          revenue, cartConversion, aiScore, aiMentions,
          funnelData: funnel,
          rankingWins: rankings,
          visualKeywords: visualKws,
          aiPlatforms,
          nextSteps,
          analystNotes: notes,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const link = `${window.location.origin}/clients/${clientId}/results/${data.report.id}`;
      setSavedLink(link);
      onSaved(data.report);
    } catch (e) {
      console.error("[ReportForm] Save error:", e);
      alert(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    if (savedLink) {
      navigator.clipboard.writeText(savedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (savedLink) {
    return (
      <div className="glass-card p-6 space-y-4 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Painel criado com sucesso!</p>
        <div className="flex items-center gap-2 justify-center">
          <input
            readOnly
            value={savedLink}
            className="rounded-lg px-3 py-2 text-xs w-full max-w-md outline-none"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
          />
          <button onClick={copyLink} className="btn-primary px-3 py-2 text-xs flex items-center gap-1">
            <Copy className="h-3 w-3" />
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Compartilhe este link com o cliente. Não precisa de login.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Period */}
      <Section title="Período">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome do período"><Input value={period} onChange={setPeriod} placeholder="Out–Dez 2025" /></Field>
          <Field label="Tipo">
            <select value={periodType} onChange={(e) => setPeriodType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
            </select>
          </Field>
          <Field label="Data início"><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }} /></Field>
          <Field label="Data fim"><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full rounded-lg px-3 py-2 text-xs outline-none" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }} /></Field>
        </div>
        {periodStart && periodEnd && (
          <div className="flex items-center gap-2 mt-3">
            <button onClick={handleFillGSC} className="btn-secondary px-3 py-1.5 text-[10px] flex items-center gap-1">
              Preencher com GSC ↗
            </button>
            <button onClick={handleFillGA4} className="btn-secondary px-3 py-1.5 text-[10px] flex items-center gap-1">
              Preencher com GA4 ↗
            </button>
            {autoFillStatus && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{autoFillStatus}</span>}
          </div>
        )}
      </Section>

      {/* Main Metrics */}
      <Section title="Métricas Principais">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Cliques"><Input type="number" value={clicks} onChange={(v) => setClicks(Number(v))} /></Field>
          <Field label="Delta Cliques %"><Input type="number" value={clicksDelta} onChange={(v) => setClicksDelta(Number(v))} /></Field>
          <Field label="Impressões"><Input type="number" value={impressions} onChange={(v) => setImpressions(Number(v))} /></Field>
          <Field label="Delta Impressões %"><Input type="number" value={impressionsDelta} onChange={(v) => setImpressionsDelta(Number(v))} /></Field>
          <Field label="Receita R$"><Input type="number" value={revenue} onChange={(v) => setRevenue(Number(v))} /></Field>
          <Field label="Conversão Carrinho %"><Input type="number" value={cartConversion} onChange={(v) => setCartConversion(Number(v))} /></Field>
          <Field label="Score IA (0-100)"><Input type="number" value={aiScore} onChange={(v) => setAiScore(Number(v))} /></Field>
          <Field label="Menções IA"><Input type="number" value={aiMentions} onChange={(v) => setAiMentions(Number(v))} /></Field>
        </div>
      </Section>

      {/* Funnel */}
      <Section title="Funil de Compra" defaultOpen={false}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Produtos visualizados"><Input type="number" value={funnel.itemsViewed} onChange={(v) => setFunnel(f => ({ ...f, itemsViewed: Number(v) }))} /></Field>
          <Field label="Adicionados ao carrinho"><Input type="number" value={funnel.addedToCart} onChange={(v) => setFunnel(f => ({ ...f, addedToCart: Number(v) }))} /></Field>
          <Field label="Compras realizadas"><Input type="number" value={funnel.purchased} onChange={(v) => setFunnel(f => ({ ...f, purchased: Number(v) }))} /></Field>
        </div>
      </Section>

      {/* Rankings */}
      <Section title="Categorias que Subiram" defaultOpen={false}>
        {rankings.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label="Nome"><Input value={r.name} onChange={(v) => setRankings(rs => rs.map((x, j) => j === i ? { ...x, name: v } : x))} /></Field>
            <Field label="URL"><Input value={r.url} onChange={(v) => setRankings(rs => rs.map((x, j) => j === i ? { ...x, url: v } : x))} /></Field>
            <Field label="Posição"><Input type="number" value={r.newPosition} onChange={(v) => setRankings(rs => rs.map((x, j) => j === i ? { ...x, newPosition: Number(v) } : x))} /></Field>
            <Field label="Salto"><Input type="number" value={r.jump} onChange={(v) => setRankings(rs => rs.map((x, j) => j === i ? { ...x, jump: Number(v) } : x))} /></Field>
            <button onClick={() => setRankings(rs => rs.filter((_, j) => j !== i))} className="mb-0.5"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
          </div>
        ))}
        <button onClick={() => setRankings(rs => [...rs, { name: "", url: "", newPosition: 0, jump: 0 }])}
          className="flex items-center gap-1 text-[10px] text-brand-400 hover:underline">
          <Plus className="h-3 w-3" /> Adicionar categoria
        </button>
      </Section>

      {/* Visual Keywords */}
      <Section title="SEO Visual — Image Packs" defaultOpen={false}>
        {visualKws.map((k, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label="Keyword"><Input value={k.keyword} onChange={(v) => setVisualKws(ks => ks.map((x, j) => j === i ? { ...x, keyword: v } : x))} /></Field>
            <Field label="Posição"><Input type="number" value={k.position} onChange={(v) => setVisualKws(ks => ks.map((x, j) => j === i ? { ...x, position: Number(v) } : x))} /></Field>
            <Field label="Cliques"><Input type="number" value={k.clicks} onChange={(v) => setVisualKws(ks => ks.map((x, j) => j === i ? { ...x, clicks: Number(v) } : x))} /></Field>
            <button onClick={() => setVisualKws(ks => ks.filter((_, j) => j !== i))} className="mb-0.5"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
          </div>
        ))}
        <button onClick={() => setVisualKws(ks => [...ks, { keyword: "", position: 0, clicks: 0 }])}
          className="flex items-center gap-1 text-[10px] text-brand-400 hover:underline">
          <Plus className="h-3 w-3" /> Adicionar keyword
        </button>
      </Section>

      {/* AI Platforms */}
      <Section title="Plataformas de IA" defaultOpen={false}>
        <div className="grid grid-cols-4 gap-3">
          <Field label="ChatGPT"><Input type="number" value={aiPlatforms.chatgpt} onChange={(v) => setAiPlatforms(p => ({ ...p, chatgpt: Number(v) }))} /></Field>
          <Field label="AI Mode"><Input type="number" value={aiPlatforms.aiMode} onChange={(v) => setAiPlatforms(p => ({ ...p, aiMode: Number(v) }))} /></Field>
          <Field label="Gemini"><Input type="number" value={aiPlatforms.gemini} onChange={(v) => setAiPlatforms(p => ({ ...p, gemini: Number(v) }))} /></Field>
          <Field label="AI Overview"><Input type="number" value={aiPlatforms.aiOverview} onChange={(v) => setAiPlatforms(p => ({ ...p, aiOverview: Number(v) }))} /></Field>
        </div>
      </Section>

      {/* Next Steps */}
      <Section title="Próximos Passos" defaultOpen={false}>
        {nextSteps.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Input value={s.title} onChange={(v) => setNextSteps(ss => ss.map((x, j) => j === i ? { ...x, title: v } : x))} placeholder="Título" />
              <textarea
                value={s.description}
                onChange={(e) => setNextSteps(ss => ss.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                placeholder="Descrição"
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
              />
            </div>
            <button onClick={() => setNextSteps(ss => ss.filter((_, j) => j !== i))} className="mt-2"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
          </div>
        ))}
        <button onClick={() => setNextSteps(ss => [...ss, { title: "", description: "" }])}
          className="flex items-center gap-1 text-[10px] text-brand-400 hover:underline">
          <Plus className="h-3 w-3" /> Adicionar passo
        </button>
      </Section>

      {/* Analyst Notes */}
      <Section title="Notas do Analista (interno)" defaultOpen={false}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas internas — não aparecem no painel do cliente"
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}
        />
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={handleSave} disabled={saving || !period.trim()}
          className="btn-primary flex items-center gap-2 px-5 py-2 text-xs font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Salvar painel
        </button>
        <button onClick={onCancel} className="btn-secondary px-4 py-2 text-xs">Cancelar</button>
      </div>
    </div>
  );
}
