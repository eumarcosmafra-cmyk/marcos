"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Search,
  Users,
  Globe,
  Eye,
  MousePointerClick,
  Activity,
  Gauge,
  Plus,
  ArrowRight,
} from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { cn, formatNumber } from "@/lib/utils";
import type { Client } from "@/types/seo";

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeClients = clients.filter((c) => c.status === "active");
  const avgScore =
    activeClients.length > 0
      ? Math.round(
          activeClients.reduce((sum, c) => sum + (c.currentScore || 0), 0) /
            activeClients.length
        )
      : 0;

  const totalImpressions = clients.reduce(
    (sum, c) => sum + (c.indicators?.impressions || 0),
    0
  );
  const totalClicks = clients.reduce(
    (sum, c) => sum + (c.indicators?.clicks || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/40">
            Visão geral dos seus clientes e projetos
          </p>
        </div>
        <Link
          href="/clients"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Clientes Ativos",
            value: activeClients.length.toString(),
            icon: Users,
            detail: `${clients.length} total`,
          },
          {
            label: "Score Médio",
            value: avgScore.toString(),
            icon: TrendingUp,
            detail: "dos ativos",
          },
          {
            label: "Impressões Totais",
            value: formatNumber(totalImpressions),
            icon: Eye,
            detail: "todos os projetos",
          },
          {
            label: "Cliques Totais",
            value: formatNumber(totalClicks),
            icon: MousePointerClick,
            detail: "todos os projetos",
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <stat.icon className="h-4 w-4 text-white/30" />
              <span className="text-[10px] text-brand-400">{stat.detail}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-white/40">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Client Cards Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Projetos</h2>
          <Link
            href="/clients"
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            Ver todos <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card h-52 animate-pulse p-5"
              />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <Users className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">
              Nenhum projeto cadastrado ainda
            </p>
            <Link href="/clients" className="btn-primary mt-4">
              Cadastrar primeiro projeto
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: Client }) {
  const indicators = client.indicators;

  return (
    <Link href={`/clients/${client.id}`}>
      <div className="glass-card-hover group cursor-pointer p-5 transition-all">
        {/* Header: Name + Status */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
              <Globe className="h-5 w-5 text-white/40" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white group-hover:text-brand-400 transition-colors">
                {client.name}
              </h3>
              <p className="text-xs text-white/30">{client.domain}</p>
            </div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              client.status === "active"
                ? "bg-seo-green/10 text-seo-green"
                : "bg-white/5 text-white/30"
            )}
          >
            {client.status === "active" ? "Ativo" : "Inativo"}
          </span>
        </div>

        {/* Score */}
        <div className="mb-4 flex items-center justify-center">
          {client.currentScore !== undefined ? (
            <ScoreRing score={client.currentScore} size="sm" showLabel />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10">
              <span className="text-xs text-white/20">N/A</span>
            </div>
          )}
        </div>

        {/* Quick Indicators */}
        {indicators && (
          <div className="grid grid-cols-2 gap-2">
            <IndicatorItem
              icon={Eye}
              label="Impressões"
              value={formatNumber(indicators.impressions || 0)}
            />
            <IndicatorItem
              icon={MousePointerClick}
              label="Cliques"
              value={formatNumber(indicators.clicks || 0)}
            />
            <IndicatorItem
              icon={Activity}
              label="Sessões"
              value={formatNumber(indicators.sessions || 0)}
            />
            <IndicatorItem
              icon={Gauge}
              label="PageSpeed"
              value={indicators.performanceScore?.toString() || "—"}
              scoreColor={indicators.performanceScore}
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/20">{client.industry}</span>
          <span className="text-[10px] text-brand-400 opacity-0 transition-opacity group-hover:opacity-100">
            Ver detalhes →
          </span>
        </div>
      </div>
    </Link>
  );
}

function IndicatorItem({
  icon: Icon,
  label,
  value,
  scoreColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  scoreColor?: number;
}) {
  const valueColorClass =
    scoreColor !== undefined
      ? scoreColor >= 90
        ? "text-seo-green"
        : scoreColor >= 70
          ? "text-seo-yellow"
          : scoreColor >= 50
            ? "text-seo-orange"
            : "text-seo-red"
      : "text-white";

  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/20" />
        <span className="text-[10px] text-white/30">{label}</span>
      </div>
      <p className={cn("text-sm font-semibold", valueColorClass)}>{value}</p>
    </div>
  );
}
