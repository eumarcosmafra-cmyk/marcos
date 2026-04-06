"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientPortalDashboard } from "@/components/portal/client-portal-dashboard";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/reports")
      .then((response) => response.json())
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
      onLogout={handleLogout}
      onOpenReport={(reportId) => router.push(`/portal/reports/${reportId}`)}
    />
  );
}
