"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  BadgeDollarSign,
  Sparkles,
  LayoutGrid,
  Layers,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

export interface OrganicRevenueData {
  client: { name: string; domain: string; ga4PropertyId?: string | null };
  period: { startDate: string; endDate: string; days?: number };
  kpis: {
    clicks: number;
    clicksDelta: number;
    impressions: number;
    impressionsDelta: number;
    ctr: number;
    revenue: number;
    revenueDelta: number;
    itemsViewed: number;
    addToCarts: number;
  };
  products: Array<{
    rank: number;
    itemName: string;
    itemCategory: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    revenue: number;
    revenueDelta: number;
    revenuePerItem: number;
    addToCarts: number;
  }>;
  categories: Array<{ name: string; revenue: number; revenuePct: number; clicks: number; ctr: number }>;
  blocks: Record<"produto" | "categoria" | "conteudo" | "marca", { clicks: number; revenue: number; ctr: number }>;
  highlights: { topGanho: string; maiorGap: string; baixaCtr: string };
  topPages: Array<{ pagePath: string; pageTitle: string; sessions: number; revenue: number }>;
  analystNotes: string | null;
  alerts: Array<{ id: string; severity: string; type: string; title: string; message: string; createdAt: string }>;
  snapshotUpdatedAt: string | null;
}

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;

function Delta({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        positive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

interface Props {
  data: OrganicRevenueData;
  period: "30d" | "90d" | "6m";
  onChangePeriod: (p: "30d" | "90d" | "6m") => void;
  onLogout?: () => void;
}

export function OrganicRevenueDashboard({ data, period, onChangePeriod, onLogout }: Props) {
  const [productTab, setProductTab] = useState<"top" | "opportunity" | "drop">("top");
  const [selectedProduct, setSelectedProduct] = useState<number>(0);

  const filteredProducts = useMemo(() => {
    if (productTab === "opportunity") {
      return [...data.products]
        .filter((p) => p.impressions > 100 && p.ctr < 0.02)
        .sort((a, b) => b.impressions - a.impressions);
    }
    if (productTab === "drop") {
      return [...data.products].filter((p) => p.revenueDelta < 0).sort((a, b) => a.revenueDelta - b.revenueDelta);
    }
    return data.products.slice(0, 12);
  }, [data.products, productTab]);

  const product = filteredProducts[selectedProduct] || filteredProducts[0];

  // Scatter plot dimensions
  const maxClicks = Math.max(...filteredProducts.map((p) => p.clicks), 1);
  const maxRev = Math.max(...filteredProducts.map((p) => p.revenue), 1);

  // Actions
  const actions: string[] = [];
  if (data.products.some((p) => p.ctr < 0.02 && p.impressions > 1000)) {
    actions.push("Revisar títulos e metas dos produtos com alta impressão e baixa CTR");
  }
  if (data.blocks.conteudo.revenue > 0 && data.blocks.categoria.revenue > data.blocks.conteudo.revenue) {
    actions.push("Expandir páginas de categoria com maior receita por clique");
  }
  if (data.kpis.addToCarts > 0 && data.kpis.revenue / Math.max(data.kpis.addToCarts, 1) < 5) {
    actions.push("Auditar tracking de add_to_cart — possível quebra no funil");
  }
  actions.push("Investigar queries de alto clique sem conversão nas PDPs líderes");

  const dominantCategory = data.categories[0]?.name || "—";

  return (
    <div className="min-h-screen bg-[#07111d] text-white">
      <div className="relative flex">
        {/* Sidebar */}
        <aside className="hidden w-[200px] shrink-0 border-r border-white/6 px-5 py-7 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/20">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">MPL</p>
              <p className="text-sm font-semibold">Resultado orgânico</p>
            </div>
          </div>

          <nav className="space-y-1 text-sm">
            {[
              { label: "Overview", icon: BarChart3, active: true },
              { label: "Produtos", icon: BadgeDollarSign },
              { label: "Categorias", icon: Layers },
              { label: "Blocos", icon: LayoutGrid },
              { label: "Insights", icon: Lightbulb },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  item.active ? "bg-cyan-400/10 text-white ring-1 ring-cyan-300/15" : "text-white/45"
                }`}
              >
                <item.icon className={`h-4 w-4 ${item.active ? "text-cyan-300" : "text-white/35"}`} />
                {item.label}
              </div>
            ))}
          </nav>

          <div className="mt-8 space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">Pulso da operação</p>
            <Row label="GSC" value={data.client.domain || "—"} />
            <Row label="GA4" value={data.client.ga4PropertyId ? "conectado" : "—"} />
            <Row label="Segmento" value={dominantCategory} truncate />
            <Row label="Dispositivo" value="Mobile" />
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="mt-6 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08]"
            >
              Sair
            </button>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px] space-y-6">
            {/* Hero */}
            <section className="glass-card relative overflow-hidden rounded-[28px] border border-white/8 p-6 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(103,232,249,0.10),transparent_25%)]" />
              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">Dashboard de resultado orgânico</p>
                  <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                    Visualização de performance pensada para ligar{" "}
                    <span style={{ color: "#5DCAA5" }}>tráfego orgânico</span>, produto e{" "}
                    <span style={{ color: "#7F77DD" }}>receita</span> em uma mesma leitura.
                  </h1>
                </div>
                <div className="grid gap-2 text-right text-xs text-white/60">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Cliente</p>
                    <p className="text-sm font-semibold text-white">{data.client.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Período</p>
                    <p>{data.period.startDate} → {data.period.endDate}</p>
                  </div>
                  {data.snapshotUpdatedAt && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Último sync</p>
                      <p>{new Date(data.snapshotUpdatedAt).toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Period selector */}
              <div className="relative mt-6 flex flex-wrap gap-2">
                {(["30d", "90d", "6m"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => onChangePeriod(p)}
                    className={`rounded-full border px-4 py-2 text-xs ${
                      period === p
                        ? "border-cyan-300/30 bg-white text-slate-950"
                        : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                    }`}
                  >
                    {p === "30d" ? "Últimos 30 dias" : p === "90d" ? "Últimos 90 dias" : "Últimos 6 meses"}
                  </button>
                ))}
              </div>
            </section>

            {/* KPI bar */}
            <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="cliques orgânicos" value={fmtCompact(data.kpis.clicks)} delta={data.kpis.clicksDelta} />
              <KpiCard label="impressões" value={fmtCompact(data.kpis.impressions)} delta={data.kpis.impressionsDelta} />
              <KpiCard label="CTR média" value={fmtPct(data.kpis.ctr)} />
              <KpiCard label="receita orgânica" value={fmtBRL(data.kpis.revenue)} delta={data.kpis.revenueDelta} highlight />
              <KpiCard label="itens visualizados" value={fmtCompact(data.kpis.itemsViewed)} />
              <KpiCard label="add to cart" value={fmtCompact(data.kpis.addToCarts)} />
            </section>

            {/* Quadrante 01 — Produtos */}
            <section className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
              <div className="glass-card rounded-[28px] p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Quadrante 01</p>
                    <h2 className="mt-2 text-xl font-semibold">Produtos que puxam tráfego e capturam receita</h2>
                  </div>
                  <div className="flex gap-1">
                    {(["top", "opportunity", "drop"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setProductTab(t); setSelectedProduct(0); }}
                        className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-wider ${
                          productTab === t ? "bg-cyan-400/20 text-cyan-200" : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {t === "top" ? "Top produtos" : t === "opportunity" ? "Oportunidades" : "Queda"}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <p className="mt-6 text-center text-xs text-white/40">Sem produtos para exibir nesta visão.</p>
                ) : (
                  <>
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                            <th className="pb-2 text-left font-medium">#</th>
                            <th className="pb-2 text-left font-medium">Produto</th>
                            <th className="pb-2 text-right font-medium">Cliques</th>
                            <th className="pb-2 text-right font-medium">CTR</th>
                            <th className="pb-2 text-right font-medium">Pos.</th>
                            <th className="pb-2 text-right font-medium">Receita</th>
                            <th className="pb-2 text-right font-medium">R$/item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((p, i) => (
                            <tr
                              key={`${p.itemName}-${i}`}
                              onClick={() => setSelectedProduct(i)}
                              className={`cursor-pointer border-t border-white/5 ${i === selectedProduct ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                            >
                              <td className="py-2 text-white/40">{i + 1}</td>
                              <td className="max-w-[220px] truncate py-2">
                                <div className="text-white/85">{p.itemName}</div>
                                <div className="text-[10px] text-white/40">{p.itemCategory}</div>
                              </td>
                              <td className="py-2 text-right text-white/70 tabular-nums">{p.clicks > 0 ? fmtCompact(p.clicks) : "—"}</td>
                              <td className="py-2 text-right text-white/70 tabular-nums">{p.impressions > 0 ? fmtPct(p.ctr) : "—"}</td>
                              <td className="py-2 text-right text-white/70 tabular-nums">{p.position > 0 ? p.position.toFixed(1) : "—"}</td>
                              <td className="py-2 text-right font-semibold text-emerald-300 tabular-nums">{p.revenue > 0 ? fmtBRL(p.revenue) : "—"}</td>
                              <td className="py-2 text-right text-white/60 tabular-nums">{p.revenuePerItem > 0 ? fmtBRL(p.revenuePerItem) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Scatter plot */}
                    <div className="mt-6">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-white/35">Cliques × Receita</p>
                      <svg viewBox="0 0 600 200" className="w-full">
                        <line x1="40" y1="180" x2="590" y2="180" stroke="rgba(255,255,255,0.1)" />
                        <line x1="40" y1="20" x2="40" y2="180" stroke="rgba(255,255,255,0.1)" />
                        {filteredProducts.map((p, i) => {
                          const cx = 40 + (p.clicks / maxClicks) * 540;
                          const cy = 180 - (p.revenue / maxRev) * 150;
                          return (
                            <circle
                              key={i}
                              cx={cx}
                              cy={cy}
                              r={i === selectedProduct ? 7 : 5}
                              fill={i === selectedProduct ? "#67e8f9" : "rgba(125, 211, 252, 0.5)"}
                              stroke={i === selectedProduct ? "#fff" : "none"}
                              strokeWidth={1}
                              onClick={() => setSelectedProduct(i)}
                              style={{ cursor: "pointer" }}
                            />
                          );
                        })}
                        <text x="40" y="195" fill="rgba(255,255,255,0.4)" fontSize="9">cliques →</text>
                        <text x="40" y="14" fill="rgba(255,255,255,0.4)" fontSize="9">↑ receita</text>
                      </svg>
                    </div>

                    {/* Selected product detail */}
                    {product && (
                      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">Produto selecionado</p>
                        <h3 className="mt-2 text-base font-semibold text-white">{product.itemName}</h3>
                        <p className="text-[11px] text-white/45">{product.itemCategory}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                          <Stat label="Cliques" value={product.clicks > 0 ? fmtCompact(product.clicks) : "—"} />
                          <Stat label="CTR" value={product.impressions > 0 ? fmtPct(product.ctr) : "—"} />
                          <Stat label="Add to cart" value={fmtCompact(product.addToCarts)} />
                          <Stat label="Receita" value={fmtBRL(product.revenue)} highlight />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Highlights */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Highlights automáticos</p>
                <HighlightCard color="#5DCAA5" title="Top ganho" text={data.highlights.topGanho} />
                <HighlightCard color="#F5C36C" title="Maior gap" text={data.highlights.maiorGap} />
                <HighlightCard color="#E5736D" title="Baixa CTR" text={data.highlights.baixaCtr} />
              </div>
            </section>

            {/* Quadrante 02 — Categorias */}
            <section className="glass-card rounded-[28px] p-6 sm:p-7">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Quadrante 02</p>
              <h2 className="mt-2 text-xl font-semibold">Categorias com maior participação</h2>

              {data.categories.length === 0 ? (
                <p className="mt-5 text-xs text-white/40">Nenhuma categoria com receita registrada.</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {data.categories.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-white/85">{cat.name}</span>
                        <span className="text-white/60 tabular-nums">{fmtBRL(cat.revenue)} · {cat.revenuePct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, cat.revenuePct)}%`, background: "linear-gradient(90deg,#5DCAA5,#7F77DD)" }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-white/40">
                        <span>{fmtCompact(cat.clicks)} cliques</span>
                        <span>CTR {fmtPct(cat.ctr)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quadrante 03 — Blocos */}
            <section className="glass-card rounded-[28px] p-6 sm:p-7">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Quadrante 03</p>
              <h2 className="mt-2 text-xl font-semibold">Blocos estruturais</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["produto", "categoria", "conteudo", "marca"] as const).map((key) => {
                  const b = data.blocks[key];
                  return (
                    <div key={key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">{key}</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{fmtBRL(b.revenue)}</p>
                      <div className="mt-3 flex justify-between text-[11px] text-white/55">
                        <span>{fmtCompact(b.clicks)} cliques</span>
                        <span>CTR {fmtPct(b.ctr)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Quadrante 04 — Insights */}
            <section className="glass-card rounded-[28px] p-6 sm:p-7">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Quadrante 04</p>
              <h2 className="mt-2 text-xl font-semibold">Insights e próxima ação</h2>
              <div className="mt-5 grid gap-6 lg:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Oportunidades</p>
                  <ul className="mt-3 space-y-3 text-xs text-white/70">
                    <li className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <strong className="text-cyan-300">Oportunidade de CTR:</strong> {data.highlights.maiorGap}
                    </li>
                    <li className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <strong className="text-emerald-300">Receita concentrada:</strong> {data.highlights.topGanho}
                    </li>
                    <li className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <strong className="text-amber-300">Gap de monetização:</strong> {data.highlights.baixaCtr}
                    </li>
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Ações priorizadas</p>
                  <ol className="mt-3 space-y-2 text-xs text-white/70">
                    {actions.map((a, i) => (
                      <li key={i} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-semibold text-cyan-200">
                          {i + 1}
                        </span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Contexto humano</p>
                  <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-xs text-white/70">
                    {data.analystNotes ? (
                      <p className="whitespace-pre-wrap leading-6">{data.analystNotes}</p>
                    ) : (
                      <p className="text-white/40">Nenhuma nota registrada pelo analista no último relatório.</p>
                    )}
                  </div>

                  {data.alerts.length > 0 && (
                    <>
                      <p className="mt-5 text-[10px] uppercase tracking-[0.25em] text-white/35">Alertas críticos</p>
                      <ul className="mt-3 space-y-2 text-xs">
                        {data.alerts.map((a) => (
                          <li key={a.id} className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-white/75">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
                            <div>
                              <p className="font-semibold text-rose-200">{a.title}</p>
                              <p className="mt-1 text-[11px] text-white/55">{a.message}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function KpiCard({ label, value, delta, highlight }: { label: string; value: string; delta?: number; highlight?: boolean }) {
  return (
    <div className="glass-card rounded-2xl border border-white/8 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">{label}</p>
      <p className={`mt-3 text-xl font-semibold ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</p>
      {typeof delta === "number" && (
        <div className="mt-2"><Delta value={delta} /></div>
      )}
    </div>
  );
}

function HighlightCard({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color }}>{title}</p>
      <p className="mt-2 text-xs leading-6 text-white/75">{text}</p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/35">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-white/40">{label}</span>
      <span className={`text-white/80 ${truncate ? "max-w-[110px] truncate" : ""}`}>{value}</span>
    </div>
  );
}
