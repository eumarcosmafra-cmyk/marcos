import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  ChevronRight,
  CircleAlert,
  Eye,
  FileText,
  Globe,
  LayoutGrid,
  LogOut,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface PortalClient {
  name: string;
  domain: string;
}

interface PortalReport {
  id: string;
  period: string;
  periodType: string;
  createdAt: string;
  clicks: number;
  impressions: number;
  revenue: number;
  clicksDelta?: number;
  impressionsDelta?: number;
  cartConversion?: number;
  aiScore?: number;
  analystNotes?: string | null;
}

interface SnapshotGSC {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
}

interface SnapshotGA4 {
  revenue: number;
  transactions: number;
  sessions: number;
  users: number;
}

interface SnapshotGA4Page {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  revenue: number;
  transactions: number;
}

export interface PortalSnapshot {
  period: { startDate: string; endDate: string };
  gsc: SnapshotGSC | null;
  ga4: SnapshotGA4 | null;
  ga4Pages: SnapshotGA4Page[] | null;
}

interface PortalDashboardProps {
  client: PortalClient | null;
  reports: PortalReport[];
  snapshot?: PortalSnapshot | null;
  snapshotUpdatedAt?: string | null;
  onOpenReport?: (reportId: string) => void;
  onLogout?: () => void;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DeltaPill({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        positive
          ? "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/20"
          : "bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/20",
      ].join(" ")}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : "-"}
      {formatPercentage(Math.abs(value))}%
    </span>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon,
  delta,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  delta?: number;
}) {
  return (
    <div className="glass-card relative overflow-hidden rounded-[22px] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">{title}</p>
          <div className="mt-3 text-[2rem] font-semibold leading-none text-white">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-cyan-300 ring-1 ring-white/10">
          {icon}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs leading-relaxed text-white/45">{helper}</span>
        {typeof delta === "number" ? <DeltaPill value={delta} /> : null}
      </div>
    </div>
  );
}

export function ClientPortalDashboard({
  client,
  reports,
  snapshot,
  snapshotUpdatedAt,
  onOpenReport,
  onLogout,
}: PortalDashboardProps) {
  const latestReport = reports[0] ?? null;
  const topReports = reports.slice(0, 4);

  const ctr = latestReport && latestReport.impressions > 0
    ? (latestReport.clicks / latestReport.impressions) * 100
    : 0;

  const reportIntensity = topReports.map((report, index) => {
    const maxClicks = Math.max(...topReports.map((item) => item.clicks), 1);
    return {
      ...report,
      width: `${Math.max(26, Math.round((report.clicks / maxClicks) * 100))}%`,
      tone:
        index === 0
          ? "from-cyan-300/80 via-cyan-400/55 to-sky-500/20"
          : index === 1
            ? "from-emerald-300/75 via-emerald-400/45 to-transparent"
            : "from-white/40 via-white/20 to-transparent",
    };
  });

  const narrative = latestReport
    ? latestReport.clicksDelta && latestReport.clicksDelta > 0
      ? `A leitura mais recente mostra crescimento orgânico consistente, com ganho de demanda e espaço para empurrar produtos de maior valor comercial.`
      : `A leitura mais recente pede atenção tática: a visibilidade existe, mas o portal deve destacar páginas e produtos que precisam recuperar clique e captura de receita.`
    : "Assim que o primeiro relatório estiver disponível, o cliente verá aqui uma visão consolidada da performance orgânica, dos ganhos comerciais e das prioridades de ação.";

  return (
    <div className="min-h-screen bg-[#07111d] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_22%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_18%),linear-gradient(180deg,#07111d_0%,#08101a_45%,#050911_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[320px] bg-[linear-gradient(180deg,rgba(8,22,34,0.82),rgba(4,10,18,0.98))] ring-1 ring-inset ring-white/6" />

        <div className="relative flex min-h-screen">
          <aside className="hidden w-[290px] shrink-0 border-r border-white/6 px-6 py-8 lg:block">
            <div className="mb-10 flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.45em] text-white/35">Portal do cliente</p>
                <h1 className="mt-2 text-2xl font-semibold leading-tight text-white">
                  {client?.name || "SEO Analyst"}
                </h1>
                <p className="mt-1 text-sm text-white/45">{client?.domain || "Relatórios executivos"}</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { label: "Overview", icon: <BarChart3 className="h-4 w-4" />, active: true, href: "/portal" },
                { label: "Dashboard Orgânico", icon: <BadgeDollarSign className="h-4 w-4" />, href: "/portal/organic-revenue" },
                { label: "Relatórios", icon: <FileText className="h-4 w-4" />, href: "/portal" },
                { label: "Oportunidades", icon: <Sparkles className="h-4 w-4" />, href: "/portal" },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all",
                    item.active
                      ? "bg-cyan-400/10 text-white ring-1 ring-cyan-300/15"
                      : "text-white/52 hover:bg-white/5 hover:text-white",
                  ].join(" ")}
                >
                  <span className={item.active ? "text-cyan-300" : "text-white/40"}>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>

            <div className="mt-10 rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Fonte de dados</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/6">
                  <span className="text-sm text-white/72">Google Search Console</span>
                  <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">ativo</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/6">
                  <span className="text-sm text-white/72">Google Analytics 4</span>
                  <span className="rounded-full bg-cyan-500/12 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">conectado</span>
                </div>
              </div>
            </div>
          </aside>

          <main className="relative z-10 flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1400px] space-y-6">
              <section className="glass-card relative overflow-hidden rounded-[34px] border border-white/8 p-6 shadow-[0_40px_140px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(103,232,249,0.12),transparent_18%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,0.06),transparent_28%)]" />
                <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-4xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/12 bg-cyan-300/6 px-4 py-2 text-[11px] uppercase tracking-[0.35em] text-cyan-200/90">
                      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
                      Relatório orgânico do cliente
                    </div>
                    <h2 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.95] text-white sm:text-5xl lg:text-[4.25rem]">
                      Visualização de performance pensada para ligar
                      <span className="text-cyan-300"> tráfego orgânico</span>, produto e receita.
                    </h2>
                    <p className="mt-6 max-w-2xl text-base leading-8 text-white/62 sm:text-lg">
                      {narrative}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px] xl:max-w-[440px]">
                    {[
                      { label: "Cliente", value: client?.name || "Conta ativa" },
                      { label: "Domínio", value: client?.domain || "Conectado" },
                      { label: "Relatórios", value: `${reports.length} disponíveis` },
                      { label: "Último sync", value: latestReport ? formatDate(latestReport.createdAt) : "Pendente" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/[0.04] px-4 py-4 backdrop-blur-md">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-white/30">{item.label}</p>
                        <p className="mt-3 text-sm font-medium leading-6 text-white/88">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative mt-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-3">
                    {[
                      "Últimos 30 dias",
                      latestReport?.period || "Período atual",
                      "Mobile + Desktop",
                      "Visão executiva",
                    ].map((chip, index) => (
                      <div
                        key={chip}
                        className={[
                          "rounded-full border px-4 py-2 text-sm",
                          index === 1
                            ? "border-cyan-300/30 bg-white text-slate-950"
                            : "border-white/8 bg-white/[0.04] text-white/62",
                        ].join(" ")}
                      >
                        {chip}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex min-w-[270px] items-center gap-3 rounded-full border border-white/8 bg-[#08131f]/80 px-4 py-3 text-sm text-white/40">
                      <Search className="h-4 w-4" />
                      Buscar relatório, período ou leitura
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/78 transition hover:bg-white/[0.08]"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </div>
              </section>

              <a
                href="/portal/organic-revenue"
                className="glass-card group flex items-center justify-between rounded-[24px] border border-cyan-300/15 bg-gradient-to-r from-cyan-400/[0.06] to-transparent p-5 transition hover:border-cyan-300/30"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">Novo</p>
                  <p className="mt-2 text-lg font-semibold text-white">Ver Dashboard de Resultado Orgânico</p>
                  <p className="mt-1 text-xs text-white/55">Cruzamento de tráfego orgânico, produto e receita em uma única leitura.</p>
                </div>
                <ArrowRight className="h-5 w-5 text-cyan-300 transition group-hover:translate-x-1" />
              </a>

              {snapshot && (snapshot.gsc || snapshot.ga4) && (
                <SnapshotLiveSection snapshot={snapshot} updatedAt={snapshotUpdatedAt} />
              )}

              {latestReport ? (
                <>
                  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      title="Cliques orgânicos"
                      value={formatCompactNumber(latestReport.clicks)}
                      helper="volume capturado no período"
                      icon={<MousePointerIcon />}
                      delta={latestReport.clicksDelta ?? 0}
                    />
                    <MetricCard
                      title="Impressões"
                      value={formatCompactNumber(latestReport.impressions)}
                      helper="presença total nas SERPs"
                      icon={<Eye className="h-4 w-4" />}
                      delta={latestReport.impressionsDelta ?? 0}
                    />
                    <MetricCard
                      title="CTR estimada"
                      value={`${formatPercentage(ctr)}%`}
                      helper="relação entre clique e exposição"
                      icon={<Globe className="h-4 w-4" />}
                    />
                    <MetricCard
                      title="Receita orgânica"
                      value={formatCurrency(latestReport.revenue)}
                      helper="valor associado ao período"
                      icon={<BadgeDollarSign className="h-4 w-4" />}
                    />
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
                    <div className="glass-card rounded-[28px] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.24)] sm:p-7">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Quadrante de relatórios</p>
                          <h3 className="mt-3 text-2xl font-semibold text-white">Últimos relatórios publicados</h3>
                        </div>
                        <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/50">
                          cliente autenticado
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        {topReports.map((report) => (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => onOpenReport?.(report.id)}
                            className="group w-full rounded-[24px] border border-white/8 bg-white/[0.03] p-5 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="rounded-full border border-cyan-300/14 bg-cyan-300/8 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-200/90">
                                    {report.periodType}
                                  </span>
                                  <span className="text-xs text-white/36">publicado em {formatDate(report.createdAt)}</span>
                                </div>
                                <h4 className="mt-3 text-xl font-semibold text-white">{report.period}</h4>
                                <p className="mt-2 max-w-2xl text-sm leading-7 text-white/54">
                                  Relatório executivo preparado para leitura do cliente, cruzando visibilidade orgânica, performance comercial e oportunidades práticas.
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-sm text-white/55">
                                <span>{formatCompactNumber(report.clicks)} cliques</span>
                                <span>{formatCompactNumber(report.impressions)} impressões</span>
                                <span className="font-semibold text-emerald-300">{formatCurrency(report.revenue)}</span>
                                <span className="inline-flex items-center gap-2 text-cyan-300 transition group-hover:translate-x-1">
                                  abrir relatório
                                  <ChevronRight className="h-4 w-4" />
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="glass-card rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-7">
                        <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Leitura rápida</p>
                        <h3 className="mt-3 text-2xl font-semibold text-white">Onde agir primeiro</h3>

                        <div className="mt-6 space-y-4">
                          {[
                            {
                              title: "Proteger páginas de maior valor",
                              text: "O portal deve priorizar produtos e categorias que já convertem receita, antes de ampliar volume em páginas secundárias.",
                              tone: "text-cyan-300",
                            },
                            {
                              title: "Revisar CTR de páginas líderes",
                              text: "Queda de clique com impressão estável costuma indicar desgaste de snippet, title ou promessa comercial.",
                              tone: "text-emerald-300",
                            },
                            {
                              title: "Traduzir SEO em decisão",
                              text: "O cliente precisa enxergar resultado por produto, categoria e bloco, não só números soltos de tráfego.",
                              tone: "text-amber-300",
                            },
                          ].map((item) => (
                            <div key={item.title} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                              <p className={`text-sm font-semibold ${item.tone}`}>{item.title}</p>
                              <p className="mt-2 text-sm leading-7 text-white/54">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass-card rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-7">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Intensidade por período</p>
                            <h3 className="mt-3 text-xl font-semibold text-white">Tração dos relatórios</h3>
                          </div>
                          <CircleAlert className="h-4 w-4 text-white/30" />
                        </div>

                        <div className="mt-6 space-y-4">
                          {reportIntensity.map((item) => (
                            <div key={item.id}>
                              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                <span className="truncate text-white/70">{item.period}</span>
                                <span className="text-white/36">{formatCompactNumber(item.clicks)} cliques</span>
                              </div>
                              <div className="h-3 rounded-full bg-white/[0.05] p-[2px]">
                                <div className={`h-full rounded-full bg-gradient-to-r ${item.tone}`} style={{ width: item.width }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <section className="glass-card rounded-[28px] p-10 text-center shadow-[0_30px_90px_rgba(0,0,0,0.24)]">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300 ring-1 ring-cyan-300/20">
                    <FileText className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-white">Nenhum relatório disponível ainda</h3>
                  <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/58">
                    Assim que o primeiro relatório for publicado, o cliente verá aqui a leitura consolidada da performance orgânica, com foco em negócio e sem depender de preenchimento manual.
                  </p>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function MousePointerIcon() {
  return <ArrowRight className="h-4 w-4 -rotate-45" />;
}

function SnapshotLiveSection({
  snapshot,
  updatedAt,
}: {
  snapshot: PortalSnapshot;
  updatedAt?: string | null;
}) {
  const gsc = snapshot.gsc;
  const ga4 = snapshot.ga4;
  const ga4Pages = snapshot.ga4Pages || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Performance ao vivo · últimos 28 dias</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Snapshot GSC + GA4</h3>
        </div>
        {updatedAt && (
          <span className="text-[11px] text-white/40">
            Atualizado em {new Date(updatedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {gsc && (
          <>
            <MetricCard title="Cliques (GSC)" value={formatCompactNumber(gsc.totalClicks)} helper="orgânico capturado" icon={<Search className="h-4 w-4" />} />
            <MetricCard title="Impressões" value={formatCompactNumber(gsc.totalImpressions)} helper="presença nas SERPs" icon={<Eye className="h-4 w-4" />} />
          </>
        )}
        {ga4 && (
          <>
            <MetricCard title="Receita orgânica" value={formatCurrency(ga4.revenue)} helper="GA4 · canal Organic Search" icon={<BadgeDollarSign className="h-4 w-4" />} />
            <MetricCard title="Sessões orgânicas" value={formatCompactNumber(ga4.sessions)} helper={`${formatCompactNumber(ga4.transactions)} transações`} icon={<ShoppingCart className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {gsc && gsc.topQueries.length > 0 && (
          <div className="glass-card rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Top queries</p>
            <h4 className="mt-3 text-lg font-semibold text-white">O que está trazendo cliques</h4>
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  <th className="pb-3 text-left font-medium">Query</th>
                  <th className="pb-3 text-right font-medium">Cliques</th>
                  <th className="pb-3 text-right font-medium">Impr.</th>
                  <th className="pb-3 text-right font-medium">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {gsc.topQueries.slice(0, 8).map((q, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="max-w-[220px] truncate py-2 text-white/80">{q.keys?.[0] || "—"}</td>
                    <td className="py-2 text-right text-white/70 tabular-nums">{formatCompactNumber(q.clicks)}</td>
                    <td className="py-2 text-right text-white/50 tabular-nums">{formatCompactNumber(q.impressions)}</td>
                    <td className="py-2 text-right text-white/50 tabular-nums">{q.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ga4Pages.length > 0 && (
          <div className="glass-card rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/35">Páginas orgânicas</p>
            <h4 className="mt-3 text-lg font-semibold text-white">Top pages que geram receita</h4>
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  <th className="pb-3 text-left font-medium">Página</th>
                  <th className="pb-3 text-right font-medium">Sessões</th>
                  <th className="pb-3 text-right font-medium">Receita</th>
                </tr>
              </thead>
              <tbody>
                {ga4Pages.slice(0, 8).map((p, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="max-w-[220px] truncate py-2 text-white/80" title={p.pagePath}>
                      {p.pageTitle || p.pagePath}
                    </td>
                    <td className="py-2 text-right text-white/70 tabular-nums">{formatCompactNumber(p.sessions)}</td>
                    <td className="py-2 text-right font-semibold text-emerald-300 tabular-nums">{formatCurrency(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
