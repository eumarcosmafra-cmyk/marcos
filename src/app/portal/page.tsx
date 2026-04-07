"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Report {
  id: string;
  period: string;
  periodType: string;
  createdAt: string;
  clicks: number;
  impressions: number;
  revenue: number;
}

interface GSCSnapshot {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
}

interface GA4Snapshot {
  revenue: number;
  transactions: number;
  sessions: number;
  users: number;
}

interface GA4Page {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  revenue: number;
  transactions: number;
}

interface Snapshot {
  period: { startDate: string; endDate: string };
  gsc: GSCSnapshot | null;
  ga4: GA4Snapshot | null;
  ga4Pages: GA4Page[] | null;
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export default function PortalPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [client, setClient] = useState<{ name: string; domain: string } | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/reports").then(r => r.json()),
      fetch("/api/portal/dashboard").then(r => r.json()),
    ])
      .then(([reportsData, dashData]) => {
        if (reportsData.error || dashData.error) {
          router.push("/portal/login");
          return;
        }
        setReports(reportsData.reports || []);
        setClient(reportsData.client || dashData.client || null);
        setSnapshot(dashData.snapshot || null);
        setSnapshotUpdatedAt(dashData.snapshotUpdatedAt || null);
      })
      .catch(() => router.push("/portal/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#666" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "2px" }}>{client?.name || "Portal"}</h1>
            <p style={{ fontSize: "13px", color: "#666" }}>{client?.domain}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #e5e5e5", background: "#fff", fontSize: "12px", cursor: "pointer" }}
          >
            Sair
          </button>
        </div>

        {/* Dashboard */}
        {snapshot ? (
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Visão Geral · Últimos 28 dias</h2>
              {snapshotUpdatedAt && (
                <span style={{ fontSize: "11px", color: "#999" }}>
                  Atualizado em {new Date(snapshotUpdatedAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
              {snapshot.gsc && (
                <>
                  <KpiCard label="Cliques (GSC)" value={fmt(snapshot.gsc.totalClicks)} />
                  <KpiCard label="Impressões (GSC)" value={fmt(snapshot.gsc.totalImpressions)} />
                  <KpiCard label="CTR Médio" value={fmtPct(snapshot.gsc.avgCtr)} />
                  <KpiCard label="Posição Média" value={snapshot.gsc.avgPosition.toFixed(1)} />
                </>
              )}
              {snapshot.ga4 && (
                <>
                  <KpiCard label="Sessões (GA4)" value={fmt(snapshot.ga4.sessions)} />
                  <KpiCard label="Receita" value={fmtBRL(snapshot.ga4.revenue)} highlight />
                  <KpiCard label="Transações" value={fmt(snapshot.ga4.transactions)} />
                  <KpiCard label="Usuários" value={fmt(snapshot.ga4.users)} />
                </>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "16px" }}>
              {/* Top Queries */}
              {snapshot.gsc && snapshot.gsc.topQueries.length > 0 && (
                <Panel title="Top Queries (GSC)">
                  <Table
                    headers={["Query", "Cliques", "Impr.", "Pos."]}
                    rows={snapshot.gsc.topQueries.map(q => [
                      q.keys?.[0] || "—",
                      fmt(q.clicks),
                      fmt(q.impressions),
                      q.position.toFixed(1),
                    ])}
                  />
                </Panel>
              )}

              {/* Top Pages GSC */}
              {snapshot.gsc && snapshot.gsc.topPages.length > 0 && (
                <Panel title="Top Páginas (GSC)">
                  <Table
                    headers={["Página", "Cliques", "Impr."]}
                    rows={snapshot.gsc.topPages.map(p => [
                      shortUrl(p.keys?.[0] || ""),
                      fmt(p.clicks),
                      fmt(p.impressions),
                    ])}
                  />
                </Panel>
              )}

              {/* GA4 Organic Pages */}
              {snapshot.ga4Pages && snapshot.ga4Pages.length > 0 && (
                <Panel title="Páginas Orgânicas (GA4)">
                  <Table
                    headers={["Página", "Sessões", "Receita"]}
                    rows={snapshot.ga4Pages.slice(0, 10).map(p => [
                      p.pageTitle || shortUrl(p.pagePath),
                      fmt(p.sessions),
                      fmtBRL(p.revenue),
                    ])}
                  />
                </Panel>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", textAlign: "center", border: "1px solid #e5e5e5", marginBottom: "2rem" }}>
            <p style={{ color: "#666", fontSize: "13px" }}>Dashboard ainda não foi gerado pelo seu consultor.</p>
          </div>
        )}

        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Seus Relatórios</h2>

        {reports.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "40px", textAlign: "center", border: "1px solid #e5e5e5" }}>
            <p style={{ color: "#666", fontSize: "14px" }}>Nenhum relatório disponível ainda.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reports.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/portal/reports/${r.id}`)}
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "20px",
                  border: "1px solid #e5e5e5",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "box-shadow 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")}
                onMouseOut={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>{r.period}</p>
                  <p style={{ fontSize: "12px", color: "#666" }}>
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")} · {r.periodType}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#666" }}>
                  <span>{r.clicks.toLocaleString("pt-BR")} cliques</span>
                  <span>{r.impressions.toLocaleString("pt-BR")} impressões</span>
                  <span style={{ color: "#E85D20", fontWeight: 600 }}>Ver →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: "11px", color: "#999", marginTop: "40px" }}>
          SEO Analyst · Portal do Cliente
        </p>
      </div>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "12px",
      padding: "16px",
      border: "1px solid #e5e5e5",
    }}>
      <p style={{ fontSize: "10px", color: "#999", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{label}</p>
      <p style={{ fontSize: "22px", fontWeight: 700, color: highlight ? "#E85D20" : "#111" }}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #e5e5e5" }}>
      <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px" }}>{title}</h3>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "6px 4px", color: "#999", fontWeight: 500, fontSize: "10px", textTransform: "uppercase", borderBottom: "1px solid #f0f0f0" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ textAlign: j === 0 ? "left" : "right", padding: "6px 4px", borderBottom: "1px solid #f7f7f7", color: j === 0 ? "#111" : "#444", maxWidth: j === 0 ? "260px" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname || url;
  } catch {
    return url;
  }
}
