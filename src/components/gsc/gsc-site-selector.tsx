"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Globe, ChevronDown, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GSCSite } from "@/types/gsc";

interface GSCSiteSelectorProps {
  selectedSite: string;
  onSelect: (siteUrl: string) => void;
}

export function GSCSiteSelector({ selectedSite, onSelect }: GSCSiteSelectorProps) {
  const { data: session } = useSession();
  const [sites, setSites] = useState<GSCSite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);

    fetch("/api/gsc/sites")
      .then((r) => r.json())
      .then((json) => {
        if (json.sites) setSites(json.sites);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  if (!session?.accessToken) return null;

  const selectedLabel = selectedSite
    ? selectedSite.replace("sc-domain:", "").replace(/https?:\/\//, "").replace(/\/$/, "")
    : "Selecione um site";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="input-field flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-white/20" />
          <span className={cn("text-sm", selectedSite ? "text-white" : "text-white/30")}>
            {loading ? "Carregando sites..." : selectedLabel}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-white/30 transition-transform", open && "rotate-180")} />
      </button>

      {open && sites.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#0d0d14] py-1 shadow-xl">
          {sites.map((site) => (
            <button
              key={site.siteUrl}
              onClick={() => {
                onSelect(site.siteUrl);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-xs text-white/70 hover:bg-white/5"
            >
              <span>
                {site.siteUrl.replace("sc-domain:", "").replace(/https?:\/\//, "").replace(/\/$/, "")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/20">{site.permissionLevel}</span>
                {site.siteUrl === selectedSite && (
                  <CheckCircle className="h-3 w-3 text-brand-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && sites.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-[#0d0d14] p-4 shadow-xl">
          <p className="text-center text-xs text-white/30">
            Nenhum site encontrado no Search Console
          </p>
        </div>
      )}
    </div>
  );
}
