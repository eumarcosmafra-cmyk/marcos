"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Zap,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Target,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/types/gsc";

interface OpportunitiesTableProps {
  siteUrl: string;
  period?: string;
  compact?: boolean;
}

type SortKey = "score" | "impressions" | "position" | "ctr";

export function OpportunitiesTable({
  siteUrl,
  period = "28d",
  compact = false,
}: OpportunitiesTableProps) {
  const { data: session } = useSession();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchOpportunities = async () => {
    if (!session?.accessToken || !siteUrl) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/gsc/opportunities?siteUrl=${encodeURIComponent(siteUrl)}&period=${period}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOpportunities(json.opportunities || []);
      setTotalAnalyzed(json.totalAnalyzed || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar oportunidades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, siteUrl, period]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...opportunities].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const display = compact ? sorted.slice(0, 5) : sorted;

  if (!session?.accessToken) return null;

  const truncateUrl = (url: string) => {
    try {
      const u = new URL(url);
      const path = u.pathname + u.search;
      return path.length > 45 ? path.substring(0, 45) + "..." : path;
    } catch {
      return url.length > 45 ? url.substring(0, 45) + "..." : url;
    }
  };

  const getPositionBadge = (pos: number) => {
    if (pos < 10)
      return { bg: "bg-seo-green/10", text: "text-seo-green", label: "Quase top 10" };
    if (pos <= 15)
      return { bg: "bg-seo-yellow/10", text: "text-seo-yellow", label: "Quase lá" };
    if (pos <= 20)
      return { bg: "bg-seo-orange/10", text: "text-seo-orange", label: "2ª página" };
    return { bg: "bg-seo-red/10", text: "text-seo-red", label: "3ª página" };
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-seo-yellow" />
          <h3 className="text-sm font-semibold text-white">
            Detector de Oportunidades
          </h3>
          {opportunities.length > 0 && (
            <span className="rounded-full bg-seo-yellow/10 px-2 py-0.5 text-[10px] font-medium text-seo-yellow">
              {opportunities.length} encontradas
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalAnalyzed > 0 && (
            <span className="text-[10px] text-white/20">
              {totalAnalyzed} queries analisadas
            </span>
          )}
          <button
            onClick={fetchOpportunities}
            disabled={loading}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white/50"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", loading && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && opportunities.length === 0 ? (
        <div className="space-y-2 p-5">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Target className="h-4 w-4 animate-pulse" />
            Analisando queries do GSC...
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : error ? (
        <div className="p-5 text-center text-xs text-seo-red">{error}</div>
      ) : opportunities.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <TrendingUp className="h-8 w-8 text-white/10" />
          <p className="text-xs text-white/30">
            Nenhuma oportunidade encontrada neste período
          </p>
          <p className="text-[10px] text-white/20">
            Isso pode significar que seu site já está bem posicionado ou precisa
            de mais impressões
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-5 py-2 text-[10px] font-medium uppercase text-white/30">
                  Query / Página
                </th>
                {[
                  { key: "impressions" as SortKey, label: "Impressões" },
                  { key: "position" as SortKey, label: "Posição" },
                  { key: "ctr" as SortKey, label: "CTR" },
                  { key: "score" as SortKey, label: "Score" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer px-5 py-2 text-[10px] font-medium uppercase text-white/30 hover:text-white/50"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown
                        className={cn(
                          "h-3 w-3",
                          sortKey === col.key && "text-seo-yellow"
                        )}
                      />
                    </span>
                  </th>
                ))}
                <th className="px-5 py-2 text-[10px] font-medium uppercase text-white/30">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {display.map((opp, i) => {
                const badge = getPositionBadge(opp.position);
                return (
                  <tr
                    key={i}
                    className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-xs font-medium text-white">
                          {opp.query}
                        </p>
                        <a
                          href={opp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-brand-400"
                        >
                          {truncateUrl(opp.url)}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-purple-400">
                      {opp.impressions.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-3 text-xs font-medium text-seo-yellow">
                      {opp.position.toFixed(1)}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">
                      {opp.ctr.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-seo-yellow"
                            style={{
                              width: `${Math.min(100, (opp.score / (sorted[0]?.score || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-white/30">
                          {Math.round(opp.score)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          badge.bg,
                          badge.text
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Tips */}
      {opportunities.length > 0 && (
        <div className="border-t border-white/5 px-5 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase text-white/20">
            Ações recomendadas para cada oportunidade:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Adicionar +150 palavras de conteúdo",
              "Incluir 3 FAQs na página",
              "Otimizar título e meta description",
              "Melhorar linkagem interna",
            ].map((tip) => (
              <span
                key={tip}
                className="rounded-lg bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/40"
              >
                {tip}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
