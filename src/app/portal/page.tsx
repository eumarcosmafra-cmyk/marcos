"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientPortalDashboard } from "@/components/portal/client-portal-dashboard";
import type { OrganicRevenueData } from "@/components/portal/organic-revenue-dashboard";

export default function PortalPage() {
  const router = useRouter();
  const [data, setData] = useState<OrganicRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/organic-revenue")
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.client) {
          router.push("/portal/login");
          return;
        }
        if (d.error) {
          setError(d.error);
          return;
        }
        setData(d);
      })
      .catch((e) => {
        console.error("[portal] Error:", e);
        setError("Erro ao carregar dashboard.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  return (
    <ClientPortalDashboard
      data={data}
      loading={loading}
      error={error}
      onLogout={handleLogout}
    />
  );
}
