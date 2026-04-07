"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientPortalDashboard, type PortalSnapshot } from "@/components/portal/client-portal-dashboard";

interface Report {
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

interface ClientInfo {
  name: string;
  domain: string;
}

export default function PortalPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/reports").then(r => r.json()),
      fetch("/api/portal/dashboard").then(r => r.json()),
    ])
      .then(([reportsData, dashData]) => {
        if (reportsData.error) {
          router.push("/portal/login");
          return;
        }
        setReports(reportsData.reports || []);
        setClient(reportsData.client || dashData.client || null);
        if (!dashData.error) {
          setSnapshot(dashData.snapshot || null);
          setSnapshotUpdatedAt(dashData.snapshotUpdatedAt || null);
        }
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
      <div className="flex min-h-screen items-center justify-center bg-[#07111d] text-white">
        <div className="glass-card rounded-[28px] px-8 py-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <p className="text-sm uppercase tracking-[0.32em] text-white/35">Portal do cliente</p>
          <p className="mt-3 text-lg font-medium text-white/80">Carregando ambiente de relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <ClientPortalDashboard
      client={client}
      reports={reports}
      snapshot={snapshot}
      snapshotUpdatedAt={snapshotUpdatedAt}
      onLogout={handleLogout}
      onOpenReport={(reportId) => router.push(`/portal/reports/${reportId}`)}
    />
  );
}
