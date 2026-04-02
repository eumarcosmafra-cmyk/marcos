import type { ClientReport } from "@/types/client-report";

interface Props {
  report: ClientReport;
}

const ACCENT = "#E85D20";
const TEXT_PRIMARY = "#1a1a1a";
const TEXT_SECONDARY = "#666";
const BORDER = "#e5e5e5";
const BG_CARD = "#ffffff";
const BG_ACCENT_LIGHT = "#FFF3E0";

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 600,
      backgroundColor: positive ? "#E8F5E9" : "#FFEBEE",
      color: positive ? "#2E7D32" : "#C62828",
    }}>
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function MetricCard({ label, value, delta, suffix }: {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
}) {
  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: "12px",
      padding: "20px",
      textAlign: "center",
    }}>
      <p style={{ fontSize: "12px", color: TEXT_SECONDARY, marginBottom: "8px", fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: "28px", fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.2 }}>
        {typeof value === "number" ? formatNumber(value) : value}
        {suffix && <span style={{ fontSize: "16px", fontWeight: 500 }}>{suffix}</span>}
      </p>
      {delta !== undefined && delta !== 0 && (
        <div style={{ marginTop: "6px" }}>
          <DeltaBadge value={delta} />
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: BG_CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: "12px",
      padding: "24px",
    }}>
      <h3 style={{ fontSize: "14px", fontWeight: 700, color: TEXT_PRIMARY, marginBottom: "16px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ResultsPanel({ report }: Props) {
  const rankings = (report.rankingWins || []) as { name: string; url?: string; newPosition: number; jump: number; impressionsDelta?: number }[];
  const visualKws = (report.visualKeywords || []) as { keyword: string; position: number; clicks: number }[];
  const funnel = report.funnelData as { itemsViewed: number; addedToCart: number; purchased: number } | null;
  const aiPlatforms = report.aiPlatforms as { chatgpt: number; aiMode: number; gemini: number; aiOverview: number } | null;
  const nextSteps = (report.nextSteps || []) as { title: string; description: string }[];

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: TEXT_PRIMARY }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "4px" }}>
          {report.client?.name || "Cliente"}
        </h1>
        <p style={{ fontSize: "13px", color: TEXT_SECONDARY }}>
          {report.client?.domain} · {report.period}
        </p>
        <p style={{ fontSize: "13px", color: TEXT_SECONDARY, marginTop: "12px" }}>
          Aqui está o resumo dos principais resultados de SEO do período.
          Os dados abaixo refletem a performance orgânica real do seu site no Google.
        </p>
      </div>

      {/* 5 Metric Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "12px",
        marginBottom: "24px",
      }}>
        <MetricCard label="Cliques" value={report.clicks} delta={report.clicksDelta} />
        <MetricCard label="Impressões" value={report.impressions} delta={report.impressionsDelta} />
        <MetricCard label="Receita" value={`R$ ${formatNumber(report.revenue)}`} />
        <MetricCard label="Conversão Carrinho" value={`${report.cartConversion}%`} />
        <MetricCard label="Score IA" value={report.aiScore} suffix={`/100`} />
      </div>

      {/* Insight box */}
      <div style={{
        background: BG_ACCENT_LIGHT,
        borderLeft: `4px solid ${ACCENT}`,
        borderRadius: "8px",
        padding: "16px 20px",
        marginBottom: "24px",
      }}>
        <p style={{ fontSize: "13px", color: TEXT_PRIMARY, lineHeight: 1.6 }}>
          {report.clicksDelta > 0
            ? `Os cliques orgânicos cresceram ${report.clicksDelta.toFixed(1)}% no período, indicando ganho de visibilidade real.`
            : report.clicksDelta < 0
              ? `Os cliques orgânicos caíram ${Math.abs(report.clicksDelta).toFixed(1)}% no período. Atenção especial às categorias em queda.`
              : "Cliques estáveis no período."}
          {report.impressionsDelta > 0 && ` As impressões subiram ${report.impressionsDelta.toFixed(1)}%, mostrando que o Google está exibindo mais o site nos resultados.`}
          {report.aiMentions > 0 && ` O site foi mencionado ${report.aiMentions} vezes em plataformas de IA.`}
        </p>
      </div>

      {/* Grid 2x2 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
        marginBottom: "32px",
      }}>
        {/* Rankings */}
        <SectionCard title="Categorias que subiram de posição">
          {rankings.length === 0 ? (
            <p style={{ fontSize: "12px", color: TEXT_SECONDARY }}>Nenhuma movimentação neste período.</p>
          ) : (
            <div>
              {rankings.map((r, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < rankings.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600 }}>{r.name}</p>
                    {r.impressionsDelta !== undefined && (
                      <p style={{ fontSize: "11px", color: TEXT_SECONDARY }}>
                        +{formatNumber(r.impressionsDelta)} impressões
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      display: "inline-block",
                      background: "#E8F5E9",
                      color: "#2E7D32",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}>
                      ↑ {r.jump} posições → #{r.newPosition}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Funnel */}
        <SectionCard title="Funil de compra">
          {!funnel ? (
            <p style={{ fontSize: "12px", color: TEXT_SECONDARY }}>Dados não disponíveis.</p>
          ) : (
            <div>
              {[
                { label: "Produtos visualizados", value: funnel.itemsViewed, color: "#E3F2FD" },
                { label: "Adicionados ao carrinho", value: funnel.addedToCart, color: "#FFF3E0" },
                { label: "Compras realizadas", value: funnel.purchased, color: "#E8F5E9" },
              ].map((step, i) => {
                const maxVal = Math.max(funnel.itemsViewed, 1);
                const pct = (step.value / maxVal) * 100;
                return (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "12px", color: TEXT_SECONDARY }}>{step.label}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{formatNumber(step.value)}</span>
                    </div>
                    <div style={{ height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: ACCENT, borderRadius: "4px", transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* SEO Visual */}
        <SectionCard title="SEO Visual — Image Packs">
          {visualKws.length === 0 ? (
            <p style={{ fontSize: "12px", color: TEXT_SECONDARY }}>Nenhum dado disponível.</p>
          ) : (
            <div>
              {visualKws.map((kw, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < visualKws.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>{kw.keyword}</span>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <span style={{
                      background: ACCENT,
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}>
                      #{kw.position}
                    </span>
                    <span style={{ fontSize: "12px", color: TEXT_SECONDARY }}>{kw.clicks} cliques</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* AI Visibility */}
        <SectionCard title="Visibilidade em IA">
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ fontSize: "36px", fontWeight: 700, color: ACCENT }}>{report.aiScore}</span>
              <span style={{ fontSize: "14px", color: TEXT_SECONDARY }}>/100</span>
            </div>
            <p style={{ fontSize: "12px", color: TEXT_SECONDARY, marginTop: "4px" }}>
              {report.aiMentions} menções em plataformas de IA
            </p>
          </div>
          {aiPlatforms && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { name: "ChatGPT", value: aiPlatforms.chatgpt },
                { name: "AI Mode", value: aiPlatforms.aiMode },
                { name: "Gemini", value: aiPlatforms.gemini },
                { name: "AI Overview", value: aiPlatforms.aiOverview },
              ].map((p) => (
                <div key={p.name} style={{
                  background: "#f8f8f8",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  textAlign: "center",
                }}>
                  <p style={{ fontSize: "18px", fontWeight: 700, color: TEXT_PRIMARY }}>{p.value}</p>
                  <p style={{ fontSize: "10px", color: TEXT_SECONDARY }}>{p.name}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Próximos passos</h3>
          <div>
            {nextSteps.map((step, i) => (
              <div key={i} style={{
                display: "flex",
                gap: "16px",
                padding: "16px 0",
                borderBottom: i < nextSteps.length - 1 ? `1px solid ${BORDER}` : "none",
              }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: ACCENT,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{step.title}</p>
                  <p style={{ fontSize: "13px", color: TEXT_SECONDARY, lineHeight: 1.5 }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px 0", borderTop: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: "11px", color: "#999" }}>
          Relatório gerado por SEO Analyst · {new Date(report.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
