"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrganicRevenueDashboard, type OrganicRevenueData } from "@/components/portal/organic-revenue-dashboard";

type Period = "30d" | "90d" | "6m";

const PERIOD_DAYS: Record<Period, number> = { "30d": 30, "90d": 90, "6m": 180 };

function dateRange(days: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export default function OrganicRevenuePage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("90d");
  const [data, setData] = useState<OrganicRevenueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const { startDate, endDate } = dateRange(PERIOD_DAYS[period]);
    fetch(`/api/portal/organic-revenue?startDate=${startDate}&endDate=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.client) {
          router.push("/portal/login");
          return;
        }
        if (d.error) {
          setError(d.error);
          setData(null);
          return;
        }
        setData(d);
      })
      .catch((e) => {
        console.error("[organic-revenue] Error:", e);
        setError("Erro ao carregar dashboard.");
      })
      .finally(() => setLoading(false));
  }, [period, router]);

  async function handleLogout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07111d] p-8 text-white">
        <div className="mx-auto max-w-[1400px] space-y-4">
          <div className="h-12 animate-pulse rounded-xl bg-white/5" />
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07111d] p-8 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm uppercase tracking-[0.32em] text-white/35">Dashboard indisponível</p>
          <p className="mt-4 text-base text-white/75">{error || "Sem dados para exibir."}</p>
          <button
            onClick={() => router.push("/portal")}
            className="mt-6 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2 text-xs text-white/70 hover:bg-white/[0.08]"
          >
            Voltar ao portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <OrganicRevenueDashboard
      data={data}
      period={period}
      onChangePeriod={setPeriod}
      onLogout={handleLogout}
    />
  );
}
