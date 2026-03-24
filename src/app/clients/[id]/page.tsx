"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Globe,
  ArrowLeft,
  Search,
  TrendingUp,
  FileText,
  MessageSquare,
  Eye,
  MousePointerClick,
  Activity,
  Gauge,
  Calendar,
  Tag,
} from "lucide-react";
import { ScoreRing } from "@/components/ui/score-ring";
import { LoadingSpinner } from "@/components/ui/loading";
import { GSCOverviewCard } from "@/components/gsc/gsc-overview-card";
import { TopQueriesTable } from "@/components/gsc/top-queries-table";
import { TopPagesTable } from "@/components/gsc/top-pages-table";
import { cn, formatDate, formatNumber, getScoreColor, getScoreLabel } from "@/lib/utils";
import type { Client } from "@/types/seo";
import type { GSCSite } from "@/types/gsc";

export default function ClientDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [gscSiteUrl, setGscSiteUrl] = useState<string>("");
  const [gscTab, setGscTab] = useState<"queries" | "pages">("queries");

  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data: Client[]) => {
        const found = data.find((c) => c.id === params.id);
        setClient(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  // Auto-match client domain to GSC site
  useEffect(() => {
    if (!session?.accessToken || !client?.domain) return;

    fetch("/api/gsc/sites")
      .then((r) => r.json())
      .then((json) => {
        if (!json.sites) return;
        const domain = client.domain.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
        const match = (json.sites as GSCSite[]).find(
          (s) =>
            s.siteUrl === `sc-domain:${domain}` ||
            s.siteUrl.includes(domain)
        );
        if (match) setGscSiteUrl(match.siteUrl);
      })
      .catch(() => {});
  }, [session?.accessToken, client?.domain]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Link href="/clients" className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
          <ArrowLeft className="h-4 w-4" />
          Voltar para clientes
        </Link>
        <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
          <Globe className="mb-3 h-10 w-10 text-white/20" />
          <p className="text-sm text-white/40">Cliente não encontrado</p>
        </div>
      </div>
    );
  }

  const indicators = client.indicators;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/clients" className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
        <ArrowLeft className="h-4 w-4" />
        Voltar para clientes
      </Link>

      {/* Client Header */}
      <div className="glass-card flex items-start gap-6 p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <Globe className="h-8 w-8 text-white/40" />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{client.name}</h1>
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
          <p className="text-sm text-white/40">{client.domain}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/30">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {client.industry}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Criado em: {formatDate(client.createdAt)}
            </span>
            {client.lastAnalysis && (
              <span className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                Última análise: {formatDate(client.lastAnalysis)}
              </span>
            )}
          </div>
          {client.notes && (
            <p className="mt-2 text-xs text-white/40">{client.notes}</p>
          )}
        </div>
        {client.currentScore !== undefined && (
          <ScoreRing score={client.currentScore} size="md" showLabel />
        )}
      </div>

      {/* Indicators */}
      {indicators && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Eye}
            label="Impressões"
            value={formatNumber(indicators.impressions || 0)}
          />
          <StatCard
            icon={MousePointerClick}
            label="Cliques"
            value={formatNumber(indicators.clicks || 0)}
          />
          <StatCard
            icon={Activity}
            label="Sessões"
            value={formatNumber(indicators.sessions || 0)}
          />
          <StatCard
            icon={Gauge}
            label="PageSpeed"
            value={indicators.performanceScore?.toString() || "—"}
            scoreColor={indicators.performanceScore}
          />
        </div>
      )}

      {/* Score Details */}
      {client.currentScore !== undefined && (
        <div className="glass-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Score SEO</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-white/40">Pontuação Geral</span>
                <span className={cn("text-sm font-bold", getScoreColor(client.currentScore))}>
                  {client.currentScore}/100
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn("h-full rounded-full transition-all",
                    client.currentScore >= 90 ? "bg-seo-green" :
                    client.currentScore >= 70 ? "bg-seo-yellow" :
                    client.currentScore >= 50 ? "bg-seo-orange" : "bg-seo-red"
                  )}
                  style={{ width: `${client.currentScore}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-white/30">
                {getScoreLabel(client.currentScore)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Google Search Console Data */}
      {session?.accessToken && gscSiteUrl && (
        <>
          <GSCOverviewCard siteUrl={gscSiteUrl} compact />

          {/* Tabs: Queries / Pages */}
          <div>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setGscTab("queries")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  gscTab === "queries"
                    ? "bg-brand-600/20 text-brand-400"
                    : "text-white/30 hover:text-white/50"
                )}
              >
                Top Queries
              </button>
              <button
                onClick={() => setGscTab("pages")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  gscTab === "pages"
                    ? "bg-brand-600/20 text-brand-400"
                    : "text-white/30 hover:text-white/50"
                )}
              >
                Top Páginas
              </button>
            </div>
            {gscTab === "queries" ? (
              <TopQueriesTable siteUrl={gscSiteUrl} />
            ) : (
              <TopPagesTable siteUrl={gscSiteUrl} />
            )}
          </div>
        </>
      )}

      {session?.accessToken && !gscSiteUrl && client?.domain && (
        <div className="glass-card border-seo-yellow/10 p-4">
          <p className="text-xs text-seo-yellow">
            O domínio <strong>{client.domain}</strong> não foi encontrado no Google Search Console conectado.
            Verifique se o domínio está verificado na sua conta.
          </p>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction
            href={`/analysis/audit`}
            icon={Search}
            label="Auditoria SEO"
            desc="Análise completa"
          />
          <QuickAction
            href={`/analysis/keywords`}
            icon={TrendingUp}
            label="Keywords"
            desc="Pesquisa de palavras-chave"
          />
          <QuickAction
            href={`/reports`}
            icon={FileText}
            label="Relatório"
            desc="Gerar relatório"
          />
          <QuickAction
            href={`/analysis`}
            icon={MessageSquare}
            label="Chat IA"
            desc="Consultar analista"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
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
  const valueClass =
    scoreColor !== undefined ? getScoreColor(scoreColor) : "text-white";

  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-white/30" />
        <span className="text-xs text-white/40">{label}</span>
      </div>
      <p className={cn("text-xl font-bold", valueClass)}>{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="glass-card-hover flex flex-col items-center gap-2 p-4 text-center transition-all"
    >
      <Icon className="h-5 w-5 text-brand-400" />
      <span className="text-xs font-semibold text-white">{label}</span>
      <span className="text-[10px] text-white/30">{desc}</span>
    </Link>
  );
}
