"use client";

import type { OrganicRevenueData } from "./organic-revenue-dashboard";

// Re-export for backward compatibility
export type PortalSnapshot = unknown;

const GREEN = "#1D9E75";
const RED = "#D85A30";
const YELLOW = "#EF9F27";
const PURPLE = "#7F77DD";

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const fmtMoneyOrDash = (n: number) => (n > 0 ? fmtBRL(n) : "—");
const fmtNumOrDash = (n: number) => (n > 0 ? fmtCompact(n) : "—");

interface Props {
  data: OrganicRevenueData | null;
  loading: boolean;
  error: string | null;
  onLogout?: () => void;
}

export function ClientPortalDashboard({ data, loading, error, onLogout }: Props) {
  const syncMinutes = data?.snapshotUpdatedAt
    ? Math.max(1, Math.round((Date.now() - new Date(data.snapshotUpdatedAt).getTime()) / 60000))
    : null;
  const syncLabel = syncMinutes != null
    ? syncMinutes < 60
      ? `Sync há ${syncMinutes} min`
      : `Sync há ${Math.round(syncMinutes / 60)}h`
    : "Sem sync";

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0f1a" }}>
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className="hidden shrink-0 flex-col justify-between lg:flex"
          style={{ width: 160, background: "#0d1422", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="px-5 pt-7">
            <p className="text-[9px] uppercase tracking-[0.28em] text-white/30">Portal MPL</p>
            <p className="mt-2 text-[12px] text-white/85">{data?.client?.name || "—"}</p>
            <p className="text-[11px] text-white/35">{data?.client?.domain || ""}</p>

            <nav className="mt-10 space-y-1">
              {[
                { label: "Visão geral", active: true },
                { label: "Produtos" },
                { label: "Categorias" },
                { label: "Blocos" },
                { label: "Ações" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-2 text-[11px]"
                  style={
                    item.active
                      ? { color: GREEN, background: "rgba(29,158,117,0.08)", borderRight: `2px solid ${GREEN}` }
                      : { color: "rgba(255,255,255,0.4)" }
                  }
                >
                  <span style={{ color: item.active ? GREEN : "rgba(255,255,255,0.3)" }}>•</span>
                  {item.label}
                </div>
              ))}
            </nav>
          </div>

          <div className="px-5 pb-6 space-y-3">
            <SidebarStatus label="GSC" />
            <SidebarStatus label="GA4" />
            <p className="text-[10px] text-white/30">{syncLabel}</p>
            {onLogout && (
              <button
                onClick={onLogout}
                className="mt-2 w-full rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/55 hover:bg-white/5"
              >
                Sair
              </button>
            )}
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 overflow-x-hidden">
          {loading ? (
            <DashboardSkeleton />
          ) : error || !data ? (
            <div className="flex min-h-screen items-center justify-center p-8">
              <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.32em] text-white/35">Dashboard indisponível</p>
                <p className="mt-4 text-base text-white/75">{error || "Sem dados para exibir."}</p>
              </div>
            </div>
          ) : (
            <DashboardContent data={data} />
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarStatus({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-white/40">{label}</span>
      <span
        className="rounded px-1.5 py-0.5 text-[9px] font-medium"
        style={{ background: "rgba(29,158,117,0.15)", color: GREEN }}
      >
        ativo
      </span>
    </div>
  );
}

function DashboardContent({ data }: { data: OrganicRevenueData }) {
  const periodDays = data.period.days || 90;
  const lastSync = data.snapshotUpdatedAt
    ? new Date(data.snapshotUpdatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  // Top 5 products
  const products = data.products.slice(0, 5);

  // Categories from snapshot — fallback to grouping topPages by URL segment if categories empty
  const categories = data.categories.length > 0
    ? data.categories
    : groupPagesByUrlSegment(data.topPages);

  // Blocks: prefer pre-computed snapshot.blocks, otherwise compute from topPages
  const totalRevenue = sum(data.topPages.map((p) => p.revenue));
  const totalClicks = data.kpis.clicks || 1;
  const blocks = computeBlocks(data, totalRevenue, totalClicks);

  // Actions
  const actions = computeActions(data);

  // Highlights
  const highlights = data.highlights;

  return (
    <>
      {/* HERO */}
      <section className="px-7 pt-7 pb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/55">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
          Resultado orgânico · Últimos {periodDays} dias
        </div>
        <h1 className="mt-4 text-[26px] font-medium leading-tight text-white/95">
          Performance orgânica ligada a{" "}
          <span style={{ color: GREEN, fontWeight: 500 }}>produto</span> e{" "}
          <span style={{ color: PURPLE, fontWeight: 500 }}>receita</span>
          <br />
          — numa leitura só.
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Pill>Período atual</Pill>
          <Pill>Mobile + Desktop</Pill>
          <Pill>Brasil</Pill>
          <div className="ml-auto">
            <Pill>Atualizado {lastSync}</Pill>
          </div>
        </div>
      </section>

      {/* KPI BAR */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Kpi
          label="Cliques orgânicos"
          value={fmtCompact(data.kpis.clicks)}
          delta={data.kpis.clicksDelta}
          deltaLabel="vs período anterior"
        />
        <Kpi
          label="Impressões"
          value={fmtCompact(data.kpis.impressions)}
          delta={data.kpis.impressionsDelta}
          deltaLabel="cobertura SERP"
          divider
        />
        <Kpi
          label="Receita orgânica"
          value={fmtMoneyOrDash(data.kpis.revenue)}
          delta={data.kpis.revenueDelta}
          deltaLabel="GA4 organic"
          divider
        />
        <Kpi
          label="Add to cart"
          value={fmtCompact(data.kpis.addToCarts)}
          delta={null}
          deltaLabel="intenção comercial"
          divider
        />
      </section>

      {/* BODY */}
      <div className="space-y-4 px-7 py-5">
        {/* Row 1 - Q01 + highlights */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr) 240px" }}>
          {/* Q01 */}
          <Card>
            <CardHead eyebrow="Quadrante 01" title="Produtos que puxam tráfego e capturam receita" />
            {products.length === 0 ? (
              <p className="mt-6 text-xs text-white/40">Sem produtos com receita para exibir.</p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-[0.18em] text-white/35">
                      <th className="pb-3 text-left font-medium">#</th>
                      <th className="pb-3 text-left font-medium">Produto</th>
                      <th className="pb-3 text-right font-medium">Cliques</th>
                      <th className="pb-3 text-right font-medium">CTR</th>
                      <th className="pb-3 text-right font-medium">Pos</th>
                      <th className="pb-3 text-right font-medium">Receita</th>
                      <th className="pb-3 text-right font-medium">R$/clique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => {
                      const revPerClick = p.clicks > 0 ? p.revenue / p.clicks : 0;
                      const positive = p.revenueDelta >= 0;
                      return (
                        <tr key={`${p.itemName}-${i}`} className="border-t border-white/[0.05]">
                          <td className="py-3 text-white/35">{i + 1}</td>
                          <td className="max-w-[260px] py-3">
                            <div className="truncate font-semibold text-white/85">{p.itemName}</div>
                            <div className="text-[9px] text-white/30">{p.itemCategory}</div>
                          </td>
                          <td className="py-3 text-right tabular-nums text-white/75">{fmtNumOrDash(p.clicks)}</td>
                          <td className="py-3 text-right tabular-nums text-white/75">{p.impressions > 0 ? fmtPct(p.ctr) : "—"}</td>
                          <td className="py-3 text-right tabular-nums text-white/75">{p.position > 0 ? p.position.toFixed(1) : "—"}</td>
                          <td className="py-3 text-right tabular-nums font-semibold" style={{ color: positive ? GREEN : RED }}>
                            {fmtMoneyOrDash(p.revenue)}
                          </td>
                          <td className="py-3 text-right tabular-nums text-white/75">{revPerClick > 0 ? fmtBRL(revPerClick) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Highlights */}
          <div>
            <p className="text-[9px] uppercase tracking-[0.28em] text-white/35">Highlights</p>
            <p className="mt-2 text-[13px] font-medium text-white/85">Sinais automáticos</p>
            <div className="mt-4 space-y-3">
              <HighlightCard color={GREEN} tag="Top ganho" text={highlights.topGanho} />
              <HighlightCard color={YELLOW} tag="Maior gap" text={highlights.maiorGap} />
              <HighlightCard color={RED} tag="Baixa CTR" text={highlights.baixaCtr} />
            </div>
          </div>
        </div>

        {/* Row 2 — Q02 + Q03 */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHead eyebrow="Quadrante 02" title="Categorias por participação em receita" />
            {categories.length === 0 ? (
              <p className="mt-6 text-xs text-white/40">Sem categorias suficientes.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {categories.slice(0, 5).map((cat) => (
                  <div key={cat.name}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-white/85">{cat.name}</span>
                      <span className="text-white/55 tabular-nums">{cat.revenuePct.toFixed(0)}%</span>
                    </div>
                    <div className="h-[3px] w-full bg-white/[0.05]">
                      <div className="h-full" style={{ width: `${Math.min(100, cat.revenuePct)}%`, background: GREEN }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead eyebrow="Quadrante 03" title="Blocos estruturais do site" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["produto", "categoria", "conteudo", "marca"] as const).map((key) => (
                <BlockCard key={key} name={blockLabel(key)} block={blocks[key]} />
              ))}
            </div>
          </Card>
        </div>

        {/* Row 3 — Q04 */}
        <Card>
          <CardHead eyebrow="Quadrante 04" title="Próximos passos e contexto" />
          <div className="mt-5 grid gap-6 lg:grid-cols-3">
            {/* Ações */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Ações priorizadas</p>
              <ol className="mt-3 space-y-3">
                {actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 text-[11px] text-white/75">
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: GREEN }}
                    >
                      {i + 1}
                    </span>
                    <span className="leading-5">{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Alertas */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Alertas</p>
              <div className="mt-3 space-y-2">
                {data.alerts.length === 0 ? (
                  <p className="text-[11px] text-white/35">Nenhum alerta aberto.</p>
                ) : (
                  data.alerts.slice(0, 3).map((a) => {
                    const isCritical = a.severity === "CRITICAL";
                    const color = isCritical ? RED : YELLOW;
                    return (
                      <div
                        key={a.id}
                        className="rounded-sm bg-white/[0.02] p-3"
                        style={{ borderLeft: `3px solid ${color}` }}
                      >
                        <p className="text-[9px] uppercase tracking-[0.25em]" style={{ color }}>
                          {isCritical ? "Crítico" : "Atenção"}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-white/85">{a.title}</p>
                        <p className="mt-0.5 text-[10px] text-white/55">{a.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Nota analista */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Nota do analista</p>
              <p className="mt-3 whitespace-pre-wrap text-[11px] leading-6 text-white/65">
                {data.analystNotes || "Sem notas no relatório mais recente."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ----- Small components ----- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-[10px] text-white/55"
      style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
    >
      {children}
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  deltaLabel,
  divider,
}: {
  label: string;
  value: string;
  delta: number | null;
  deltaLabel: string;
  divider?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className="px-7 py-6"
      style={divider ? { borderLeft: "1px solid rgba(255,255,255,0.06)" } : undefined}
    >
      <p className="text-[9px] uppercase tracking-[0.28em] text-white/30">{label}</p>
      <p className="mt-3 text-[22px] font-medium text-white/90">{value}</p>
      <p className="mt-1.5 text-[11px]" style={{ color: positive ? GREEN : RED }}>
        {delta != null ? (
          <>
            {positive ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% {deltaLabel}
          </>
        ) : (
          <span className="text-white/40">{deltaLabel}</span>
        )}
      </p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md p-6"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {children}
    </div>
  );
}

function CardHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-[9px] uppercase tracking-[0.28em] text-white/35">{eyebrow}</p>
      <h2 className="mt-2 text-[15px] font-medium text-white/90">{title}</h2>
    </>
  );
}

function HighlightCard({ color, tag, text }: { color: string; tag: string; text: string }) {
  return (
    <div
      className="rounded-sm p-3"
      style={{ background: "rgba(255,255,255,0.02)", borderLeft: `3px solid ${color}` }}
    >
      <p className="text-[9px] uppercase tracking-[0.28em]" style={{ color }}>
        {tag}
      </p>
      <p className="mt-1.5 text-[11px] leading-5 text-white/75">{text}</p>
    </div>
  );
}

function BlockCard({ name, block }: { name: string; block: { clicks: number; revenue: number; ctr: number } }) {
  return (
    <div
      className="rounded-sm p-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      <p className="text-[11px] font-medium text-white/85">{name}</p>
      <div className="mt-2 flex gap-4 text-[10px]">
        <Stat label="Cliques" value={fmtCompact(block.clicks)} />
        <Stat label="Receita" value={fmtMoneyOrDash(block.revenue)} highlight />
        <Stat label="CTR" value={block.ctr > 0 ? fmtPct(block.ctr) : "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">{label}</p>
      <p className="mt-0.5 text-[12px] font-medium" style={{ color: highlight ? GREEN : "rgba(255,255,255,0.85)" }}>
        {value}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-7">
      <div className="h-8 w-2/3 animate-pulse rounded bg-white/5" />
      <div className="h-16 w-full animate-pulse rounded bg-white/5" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 240px" }}>
        <div className="h-72 animate-pulse rounded bg-white/5" />
        <div className="h-72 animate-pulse rounded bg-white/5" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-56 animate-pulse rounded bg-white/5" />
        <div className="h-56 animate-pulse rounded bg-white/5" />
      </div>
      <div className="h-48 animate-pulse rounded bg-white/5" />
    </div>
  );
}

/* ----- Helpers ----- */

function blockLabel(key: "produto" | "categoria" | "conteudo" | "marca") {
  return { produto: "Produto", categoria: "Categoria", conteudo: "Conteúdo", marca: "Marca" }[key];
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function classifyByUrl(path: string): "produto" | "categoria" | "conteudo" | "marca" {
  const p = path.toLowerCase();
  if (/\/(blog|artigo|post|guia|dica)/.test(p)) return "conteudo";
  if (/\/(categoria|colecao|collection|\/c\/|\/cat\/)/.test(p)) return "categoria";
  if (p === "/" || /\/(sobre|institucional|brand)/.test(p)) return "marca";
  return "produto";
}

function groupPagesByUrlSegment(pages: { pagePath: string; revenue: number }[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const p of pages) {
    const label = (p.pagePath.split("/").filter(Boolean)[0] || "/").slice(0, 24);
    const v = map.get(label) || 0;
    map.set(label, v + p.revenue);
    total += p.revenue;
  }
  return Array.from(map.entries())
    .map(([name, revenue]) => ({
      name,
      revenue,
      revenuePct: total > 0 ? (revenue / total) * 100 : 0,
      clicks: 0,
      ctr: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function computeBlocks(
  data: OrganicRevenueData,
  totalRevenue: number,
  totalClicks: number
) {
  // Prefer pre-computed if reasonable
  const sumComputed =
    data.blocks.produto.revenue +
    data.blocks.categoria.revenue +
    data.blocks.conteudo.revenue +
    data.blocks.marca.revenue;
  if (sumComputed > 0) return data.blocks;

  // Otherwise compute from topPages
  const out = {
    produto: { clicks: 0, revenue: 0, ctr: 0 },
    categoria: { clicks: 0, revenue: 0, ctr: 0 },
    conteudo: { clicks: 0, revenue: 0, ctr: 0 },
    marca: { clicks: 0, revenue: 0, ctr: 0 },
  };
  for (const page of data.topPages) {
    const k = classifyByUrl(page.pagePath);
    out[k].revenue += page.revenue;
  }
  // Distribute clicks proportionally to revenue if no per-block clicks available
  for (const k of Object.keys(out) as (keyof typeof out)[]) {
    const share = totalRevenue > 0 ? out[k].revenue / totalRevenue : 0;
    out[k].clicks = Math.round(totalClicks * share);
    out[k].ctr = data.kpis.ctr;
  }
  return out;
}

function computeActions(data: OrganicRevenueData): string[] {
  const actions: string[] = [];

  const lowCtrCount = data.products.filter((p) => p.impressions > 1000 && p.ctr < 0.02).length;
  if (lowCtrCount > 0) {
    actions.push(`Revisar títulos e metas dos ${lowCtrCount} produto${lowCtrCount === 1 ? "" : "s"} com alta impressão e baixa CTR`);
  }

  const transactions = data.kpis.revenue > 0 ? Math.max(1, Math.round(data.kpis.revenue / 100)) : 0;
  if (data.kpis.addToCarts > transactions * 3) {
    actions.push("Auditar tracking de add_to_cart e checkout — possível quebra no funil");
  }

  if (data.blocks.conteudo.revenue < 1 && data.topPages.some((p) => /\/(blog|artigo)/.test(p.pagePath) && p.sessions > 0)) {
    actions.push("Adicionar CTAs e links internos nas páginas de blog com tráfego");
  }

  if (data.categories.length > 0) {
    actions.push(`Expandir cobertura na categoria ${data.categories[0].name} — maior receita por clique`);
  } else {
    actions.push("Expandir cobertura nas categorias com maior receita por clique");
  }

  // Always at least 4
  while (actions.length < 4) {
    actions.push("Investigar queries de alto clique sem conversão nas PDPs líderes");
  }

  return actions.slice(0, 4);
}
