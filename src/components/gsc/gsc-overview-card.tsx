"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Eye,
  MousePointerClick,
  Percent,
  Hash,
  RefreshCw,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { GSCOverviewData } from "@/types/gsc";

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "28d", label: "28 dias" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

interface GSCOverviewCardProps {
  siteUrl: string;
  compact?: boolean;
}

export function GSCOverviewCard({ siteUrl, compact = false }: GSCOverviewCardProps) {
  const { data: session } = useSession();
  const [data, setData] = useState<GSCOverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("28d");

  const fetchData = async () => {
    if (!session?.accessToken || !siteUrl) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/gsc/analytics?siteUrl=${encodeURIComponent(siteUrl)}&period=${period}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, siteUrl, period]);

  if (!session?.accessToken) return null;

  if (error) {
    return (
      <div className="glass-card border-seo-red/10 p-4">
        <p className="text-xs text-seo-red">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Search Console
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/5 bg-white/[0.02]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "px-2.5 py-1 text-[10px] transition-colors",
                  period === p.value
                    ? "bg-brand-600/20 text-brand-400"
                    : "text-white/30 hover:text-white/50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-20 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
          <MetricCard
            icon={MousePointerClick}
            label="Cliques"
            value={formatNumber(data.totalClicks)}
            color="text-blue-400"
          />
          <MetricCard
            icon={Eye}
            label="Impressões"
            value={formatNumber(data.totalImpressions)}
            color="text-purple-400"
          />
          <MetricCard
            icon={Percent}
            label="CTR Médio"
            value={`${(data.avgCtr * 100).toFixed(1)}%`}
            color="text-seo-green"
          />
          <MetricCard
            icon={Hash}
            label="Posição Média"
            value={data.avgPosition.toFixed(1)}
            color="text-seo-yellow"
          />
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-white/40">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
