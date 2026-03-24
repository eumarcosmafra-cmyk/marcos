"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Zap, LogIn } from "lucide-react";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";
import { OpportunitiesTable } from "@/components/gsc/opportunities-table";

const PERIODS = [
  { value: "7d", label: "7 dias" },
  { value: "28d", label: "28 dias" },
  { value: "3m", label: "3 meses" },
];

export default function OpportunitiesPage() {
  const { data: session } = useSession();
  const [selectedSite, setSelectedSite] = useState("");
  const [period, setPeriod] = useState("28d");

  if (!session?.accessToken) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">
            Detector de Oportunidades
          </h1>
          <p className="text-sm text-white/40">
            Encontre quick wins reais baseados nos dados do GSC
          </p>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
          <Zap className="mb-3 h-10 w-10 text-white/20" />
          <p className="text-sm text-white/40">
            Conecte o Google Search Console para detectar oportunidades
          </p>
          <Link href="/settings" className="btn-primary mt-4 flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Conectar GSC
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Zap className="h-5 w-5 text-seo-yellow" />
            Detector de Oportunidades
          </h1>
          <p className="text-sm text-white/40">
            Páginas com alto volume na 2ª/3ª página — quick wins reais
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <GSCSiteSelector selectedSite={selectedSite} onSelect={setSelectedSite} />
        </div>
        <div className="flex rounded-lg border border-white/5 bg-white/[0.02]">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={
                period === p.value
                  ? "bg-seo-yellow/10 px-3 py-1.5 text-xs text-seo-yellow"
                  : "px-3 py-1.5 text-xs text-white/30 hover:text-white/50"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-seo-yellow/10">
            <Zap className="h-4 w-4 text-seo-yellow" />
          </div>
          <div>
            <p className="text-xs font-medium text-white">Como funciona</p>
            <p className="mt-1 text-[11px] text-white/40">
              Analisa todas as queries do GSC e encontra páginas com{" "}
              <strong className="text-white/60">muita impressão</strong> mas{" "}
              <strong className="text-white/60">posição ruim (8–25)</strong>.
              São páginas que já aparecem no Google mas não recebem cliques — o
              clássico &quot;quase ranqueando&quot;. Otimize essas páginas primeiro para
              resultados em 7–21 dias.
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {selectedSite ? (
        <OpportunitiesTable siteUrl={selectedSite} period={period} />
      ) : (
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
          <Zap className="mb-3 h-8 w-8 text-white/10" />
          <p className="text-sm text-white/30">
            Selecione um site para detectar oportunidades
          </p>
        </div>
      )}
    </div>
  );
}
