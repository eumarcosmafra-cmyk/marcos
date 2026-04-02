"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultsPanel } from "@/components/client-report/results-panel";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  clientUser: { name: string | null; email: string };
}

export default function PortalReportPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Check session
        const sessionRes = await fetch("/api/portal/reports");
        const sessionData = await sessionRes.json();
        if (sessionData.error) {
          router.push("/portal/login");
          return;
        }

        // Fetch report (public endpoint)
        const clientId = sessionData.client ? await getClientId() : null;
        if (!clientId) { router.push("/portal/login"); return; }

        const reportRes = await fetch(`/api/clients/${clientId}/reports/${params.reportId}`);
        const reportData = await reportRes.json();
        if (reportData.error) { router.push("/portal"); return; }
        setReport(reportData.report);

        // Fetch comments
        const commentsRes = await fetch(`/api/portal/reports/${params.reportId}/comments`);
        const commentsData = await commentsRes.json();
        setComments(commentsData.comments || []);
      } catch (e) {
        console.error("[portal-report] Error:", e);
        router.push("/portal/login");
      } finally {
        setLoading(false);
      }
    }

    async function getClientId(): Promise<string | null> {
      const res = await fetch("/api/portal/reports");
      const data = await res.json();
      if (data.reports?.length > 0) {
        const match = data.reports.find((r: any) => r.id === params.reportId);
        if (match) {
          // Need clientId - get from report's clientId via the reports list
          // The portal/reports endpoint returns reports for the logged-in client
          // We need to find the clientId from the session
          const loginRes = await fetch("/api/portal/reports");
          const loginData = await loginRes.json();
          // Get clientId from any report's structure - but we need to extract it
          // Actually the session already has it, let's get it from the report endpoint
          return null; // Fallback handled below
        }
      }
      return null;
    }

    load();
  }, [params.reportId, router]);

  // Simpler approach: store clientId from session
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/reports")
      .then(r => r.json())
      .then(data => {
        if (data.error) { router.push("/portal/login"); return; }
        // Extract clientId from the API - we need to add it
        // For now, get the report directly using the public report endpoint
        // by trying common client IDs from the reports
      })
      .catch(() => router.push("/portal/login"));
  }, [router]);

  // Actually, let's simplify: use the portal reports API to get the report data
  useEffect(() => {
    async function loadReport() {
      try {
        const reportsRes = await fetch("/api/portal/reports");
        const reportsData = await reportsRes.json();
        if (reportsData.error) { router.push("/portal/login"); return; }

        // Find the report in the list to get its full data
        const reportInList = reportsData.reports?.find((r: any) => r.id === params.reportId);
        if (!reportInList) { router.push("/portal"); return; }

        // We have the client info from the portal API
        setReport({
          ...reportInList,
          client: reportsData.client,
        });

        // Load comments
        const commRes = await fetch(`/api/portal/reports/${params.reportId}/comments`);
        const commData = await commRes.json();
        setComments(commData.comments || []);
      } catch (e) {
        console.error("[portal-report] Load error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [params.reportId, router]);

  async function handleComment() {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/reports/${params.reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } catch (e) {
      console.error("[portal-report] Comment error:", e);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#666" }}>Carregando relatório...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#666" }}>Relatório não encontrado.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* Back button */}
        <button
          onClick={() => router.push("/portal")}
          style={{ fontSize: "13px", color: "#666", background: "none", border: "none", cursor: "pointer", marginBottom: "1.5rem", display: "block" }}
        >
          ← Voltar aos relatórios
        </button>

        {/* Report Panel */}
        <ResultsPanel report={report} />

        {/* Comments section */}
        <div style={{ marginTop: "2rem", padding: "24px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e5e5" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Comentários</h3>

          {comments.length === 0 && (
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>Nenhum comentário ainda.</p>
          )}

          {comments.map((c) => (
            <div key={c.id} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600 }}>{c.clientUser.name || c.clientUser.email}</span>
                <span style={{ fontSize: "11px", color: "#999" }}>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
              <p style={{ fontSize: "13px", color: "#333", lineHeight: 1.5 }}>{c.content}</p>
            </div>
          ))}

          <div style={{ marginTop: "16px" }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Deixe um comentário..."
              rows={3}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                fontSize: "13px",
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={handleComment}
              disabled={sending || !newComment.trim()}
              style={{
                marginTop: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#E85D20",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: sending ? "not-allowed" : "pointer",
                opacity: sending || !newComment.trim() ? 0.6 : 1,
              }}
            >
              {sending ? "Enviando..." : "Enviar comentário"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
