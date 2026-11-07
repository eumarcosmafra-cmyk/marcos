"use client";

import { ListChecks, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Link } from "@/state/unsaved-guard";
import { api } from "./api";

export interface ShellUser {
  nome: string;
  papel: string;
  pode_decidir: boolean;
}

const PAPEL: Record<string, string> = { editor_responsavel: "Editor responsável", leitor: "Somente leitura" };

export function RealShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [saindo, setSaindo] = useState(false);

  const sair = async () => {
    setSaindo(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("[shell] Erro ao sair:", e);
    } finally {
      window.location.assign("/entrar");
    }
  };

  return (
    <div className="min-h-screen">
      <a href="#conteudo" className="sr-only z-[70] rounded bg-brand-700 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
          <Link href="/fila" className="flex items-baseline gap-1.5 rounded focus-visible:outline-brand-300">
            <span className="text-[15px] font-extrabold tracking-tight">MAFRA LABS</span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-brand-300">Editorial</span>
          </Link>
          <nav aria-label="Navegação principal" className="flex items-center gap-1">
            <Link
              href="/fila"
              aria-current={pathname.startsWith("/fila") ? "page" : undefined}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-slate-200 hover:bg-white/10 aria-[current=page]:bg-white/10 aria-[current=page]:text-white"
            >
              <ListChecks className="h-4 w-4" aria-hidden /> Fila editorial
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-1.5 text-slate-300 sm:inline-flex" title="Os dados vêm da fila editorial V2 do n8n; não há dados simulados nesta área">
              <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden /> Fonte: n8n
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-slate-400" aria-hidden />
              <span>{user.nome}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">· {PAPEL[user.papel] ?? user.papel}</span>
            </span>
            <button type="button" onClick={() => void sair()} disabled={saindo} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-200 hover:bg-white/10">
              <LogOut className="h-4 w-4" aria-hidden /> Sair
            </button>
          </div>
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-[1400px] px-3 py-5 focus-visible:outline-none sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
