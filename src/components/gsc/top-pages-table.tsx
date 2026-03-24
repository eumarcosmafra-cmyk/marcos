"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FileText, ArrowUpDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GSCPageRow } from "@/types/gsc";

interface TopPagesTableProps {
  siteUrl: string;
  period?: string;
  limit?: number;
}

type SortKey = "page" | "clicks" | "impressions" | "ctr" | "position";

export function TopPagesTable({ siteUrl, period = "28d", limit = 20 }: TopPagesTableProps) {
  const { data: session } = useSession();
  const [pages, setPages] = useState<GSCPageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!session?.accessToken || !siteUrl) return;
    setLoading(true);

    fetch(`/api/gsc/analytics?siteUrl=${encodeURIComponent(siteUrl)}&period=${period}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.topPages) setPages(json.data.topPages);
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

  const sorted = [...pages]
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    })
    .slice(0, limit);

  if (!session?.accessToken) return null;

  const truncateUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch {
      return url.length > 60 ? url.substring(0, 60) + "..." : url;
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
        <FileText className="h-4 w-4 text-brand-400" />
        <h3 className="text-sm font-semibold text-white">Top Páginas</h3>
        <span className="text-[10px] text-white/30">({pages.length})</span>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-5 text-center text-xs text-white/30">
          Nenhuma página encontrada para este período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {[
                  { key: "page" as SortKey, label: "Página" },
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
              {sorted.map((p, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.02] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-2.5">
                    <a
                      href={p.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-white/70 hover:text-brand-400"
                    >
                      {truncateUrl(p.page)}
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                    </a>
                  </td>
                  <td className="px-5 py-2.5 text-xs font-medium text-blue-400">
                    {p.clicks.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-purple-400">
                    {p.impressions.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-seo-green">
                    {(p.ctr * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-2.5 text-xs text-seo-yellow">
                    {p.position.toFixed(1)}
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
