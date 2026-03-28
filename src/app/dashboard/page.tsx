"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Users,
  Globe,
  Eye,
  MousePointerClick,
  Percent,
  Hash,
  Plus,
  ArrowRight,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { GSCOverviewCard } from "@/components/gsc/gsc-overview-card";
import { GSCSiteSelector } from "@/components/gsc/gsc-site-selector";
import type { Client } from "@/types/seo";

export default function DashboardPage() {
  const { data: session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedGSCSite, setSelectedGSCSite] = useState("");

  const syncGSCSites = useCallback(async () => {
    if (!session?.accessToken) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/gsc/sync", { method: "POST" });
      const json = await res.json();
      if (json.clients) setClients(json.clients);
    } catch (e) { console.error("[page] Error:", e); }
    setSyncing(false);
  }, [session?.accessToken]);

  useEffect(() => {
    if (session?.accessToken) {
      // Auto-sync GSC sites as clients
      syncGSCSites().then(() => setLoading(false));
    } else {
      fetch("/api/clients")
        .then((res) => res.json())
        .then((data) => {
          setClients(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session?.accessToken, syncGSCSites]);

  const activeClients = clients.filter((c) => c.status === "active");

  const totalImpressions = clients.reduce(
    (sum, c) => sum + (c.indicators?.impressions || 0),
    0
  );
  const totalClicks = clients.reduce(
    (sum, c) => sum + (c.indicators?.clicks || 0),
    0
  );
  const avgCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPosition =
    activeClients.length > 0
      ? activeClients.reduce((s, c) => s + (c.indicators?.position || 0), 0) /
        activeClients.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/40">
            Visão geral dos seus sites e projetos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session?.accessToken && (
            <button
              onClick={syncGSCSites}
              disabled={syncing}
              className="btn-secondary flex items-center gap-2 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              Sincronizar
            </button>
          )}
          <Link href="/clients" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Sites Ativos"
          value={activeClients.length.toString()}
          detail={`${clients.length} total`}
        />
        <StatCard
          icon={Eye}
          label="Impressões (28d)"
          value={formatNumber(totalImpressions)}
          detail="todos os sites"
        />
        <StatCard
          icon={MousePointerClick}
          label="Cliques (28d)"
          value={formatNumber(totalClicks)}
          detail="todos os sites"
        />
        <StatCard
          icon={Percent}
          label="CTR Médio"
          value={`${avgCtr.toFixed(1)}%`}
          detail="todos os sites"
        />
      </div>

      {/* Google Search Console */}
      {session?.accessToken ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">
              Google Search Console
            </h2>
            <div className="w-64">
              <GSCSiteSelector
                selectedSite={selectedGSCSite}
                onSelect={setSelectedGSCSite}
              />
            </div>
          </div>
          {selectedGSCSite && <GSCOverviewCard siteUrl={selectedGSCSite} />}
        </div>
      ) : (
        <div className="glass-card flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <div>
              <p className="text-sm text-white">
                Conecte o Google Search Console
              </p>
              <p className="text-xs text-white/30">
                Seus sites serão importados automaticamente
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <LogIn className="h-3 w-3" />
            Conectar
          </Link>
        </div>
      )}

      {/* Client Cards Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Seus Sites</h2>
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
              <div key={i} className="glass-card h-44 animate-pulse p-5" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-12 text-center">
            <Globe className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">
              {session?.accessToken
                ? "Nenhum site encontrado no Search Console"
                : "Conecte o Google Search Console para importar seus sites"}
            </p>
            {!session?.accessToken && (
              <Link href="/settings" className="btn-primary mt-4">
                Conectar GSC
              </Link>
            )}
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

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-4 w-4 text-white/30" />
        <span className="text-[10px] text-brand-400">{detail}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

function ClientCard({ client }: { client: Client }) {
  const indicators = client.indicators;

  return (
    <Link href={`/clients/${client.id}`}>
      <div className="glass-card-hover group cursor-pointer p-5 transition-all">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
              <Globe className="h-5 w-5 text-white/40" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
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

        {/* GSC Indicators */}
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
              icon={Percent}
              label="CTR"
              value={`${((indicators.ctr || 0) * 100).toFixed(1)}%`}
            />
            <IndicatorItem
              icon={Hash}
              label="Posição Média"
              value={(indicators.position || 0).toFixed(1)}
            />
          </div>
        )}

        {!indicators && (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-white/20">Dados não disponíveis</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
          <span className="text-[10px] text-white/20">
            {client.industry || "Google Search Console"}
          </span>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-white/20" />
        <span className="text-[10px] text-white/30">{label}</span>
      </div>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
