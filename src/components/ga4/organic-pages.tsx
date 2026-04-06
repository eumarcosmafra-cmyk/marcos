"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowDown, ArrowUp, Users, DollarSign, ShoppingCart } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface OrganicPage {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  revenue: number;
  transactions: number;
  addToCarts: number;
  conversionRate: number;
}

interface Totals {
  sessions: number;
  revenue: number;
  transactions: number;
}

type Period = "7d" | "28d" | "3m" | "6m";
type SortKey = "pageTitle" | "sessions" | "revenue" | "transactions" | "addToCarts" | "conversionRate";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "28d", label: "28 dias", days: 28 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
];

function dateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function OrganicPagesGA4({ clientId }: { clientId: string }) {
  const [period, setPeriod] = useState<Period>("28d");
  const [pages, setPages] = useState<OrganicPage[]>([]);
  const [totals, setTotals] = useState<Totals>({ sessions: 0, revenue: 0, transactions: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const days = PERIODS.find(p => p.key === period)?.days ?? 28;
    const { startDate, endDate } = dateRange(days);
    setLoading(true);
    setError(null);
    fetch("/api/ga4/organic-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, startDate, endDate }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setError(d.error);
          setPages([]);
          setTotals({ sessions: 0, revenue: 0, transactions: 0 });
        } else {
          setPages(d.pages || []);
          setTotals(d.totals || { sessions: 0, revenue: 0, transactions: 0 });
        }
      })
      .catch(e => {
        console.error("[OrganicPagesGA4] Error:", e);
        setError("Erro ao carregar dados.");
      })
      .finally(() => setLoading(false));
  }, [clientId, period]);

  const sorted = useMemo(() => {
    const arr = [...pages];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [pages, sortKey, sortDir]);

  const maxSessions = useMemo(() => Math.max(...pages.map(p => p.sessions), 1), [pages]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) {
    const active = sortKey === k;
    return (
      <th
        onClick={() => toggleSort(k)}
        className={`cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${align === "right" ? "text-right" : "text-left"}`}
        style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Páginas Orgânicas (GA4)</h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-colors ${
                period === p.key ? "bg-brand-600/20 text-brand-400" : "text-white/40 hover:text-white/70"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard icon={Users} label="Sessões orgânicas" value={formatNumber(totals.sessions)} />
        <SummaryCard icon={DollarSign} label="Receita orgânica" value={formatBRL(totals.revenue)} />
        <SummaryCard icon={ShoppingCart} label="Transações" value={formatNumber(totals.transactions)} />
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-xs text-white/40">Carregando...</div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-red-400">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-center text-xs text-white/40">Nenhuma página encontrada no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <tr>
                  <SortHeader k="pageTitle" label="Página" />
                  <SortHeader k="sessions" label="Sessões" align="right" />
                  <SortHeader k="revenue" label="Receita" align="right" />
                  <SortHeader k="transactions" label="Transações" align="right" />
                  <SortHeader k="addToCarts" label="Add Cart" align="right" />
                  <SortHeader k="conversionRate" label="Conv. Rate" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((page, i) => (
                  <tr
                    key={`${page.pagePath}-${i}`}
                    style={{ borderBottom: "1px solid var(--glass-border)" }}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="max-w-xs px-3 py-2">
                      <div className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }} title={page.pageTitle}>
                        {page.pageTitle || page.pagePath}
                      </div>
                      <div className="truncate text-[10px]" style={{ color: "var(--text-muted)" }} title={page.pagePath}>
                        {page.pagePath}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                        {formatNumber(page.sessions)}
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full bg-brand-500"
                          style={{ width: `${(page.sessions / maxSessions) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatBRL(page.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatNumber(page.transactions)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {formatNumber(page.addToCarts)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {(page.conversionRate * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-400" />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <div className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
