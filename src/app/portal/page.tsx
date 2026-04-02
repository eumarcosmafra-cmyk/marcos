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

export default function PortalPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [client, setClient] = useState<{ name: string; domain: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/reports")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push("/portal/login");
          return;
        }
        setReports(data.reports || []);
        setClient(data.client || null);
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
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
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
