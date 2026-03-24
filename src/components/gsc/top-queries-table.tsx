"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GSCQueryRow } from "@/types/gsc";

interface TopQueriesTableProps {
  siteUrl: string;
  period?: string;
  limit?: number;
}

type SortKey = "query" | "clicks" | "impressions" | "ctr" | "position";

export function TopQueriesTable({ siteUrl, period = "28d", limit = 20 }: TopQueriesTableProps) {
  const { data: session } = useSession();
  const [queries, setQueries] = useState<GSCQueryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!session?.accessToken || !siteUrl) return;
    setLoading(true);

    fetch(`/api/gsc/analytics?siteUrl=${encodeURIComponent(siteUrl)}&period=${period}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.topQueries) setQueries(json.data.topQueries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.accessToken, siteUrl, period]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...queries]
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    })
    .slice(0, limit);

  if (!session?.accessToken) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
        <Search className="h-4 w-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-white">Top Queries</h3>
        <span className="text-[10px] text-white/30">({queries.length})</span>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-5 text-center text-xs text-white/30">
          Nenhuma query encontrada para este período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {[
                  { key: "query" as SortKey, label: "Query" },
                  { key: "clicks" as SortKey, label: "Cliques" },
                  { key: "impressions" as SortKey, label: "Impressões" },
                  { key: "ctr" as SortKey, label: "CTR" },
                  { key: "position" as SortKey, label: "Posição" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer px-5 py-2 text-[10px] font-medium uppercase text-white/30 hover:text-white/50"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className={cn("h-3 w-3", sortKey === col.key && "text-brand-400")} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((q, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-2.5 text-xs text-white/70">{q.query}</td>
                  <td className="px-5 py-2.5 text-xs font-medium text-blue-400">
                    {q.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-purple-400">
                    {q.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-seo-green">
                    {(q.ctr * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-2.5 text-xs text-seo-yellow">
                    {q.position.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
