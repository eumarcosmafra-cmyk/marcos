"use client";

import clsx from "clsx";
import {
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ROLE_LABEL } from "@/lib/labels";
import { useEditorial } from "@/state/editorial";
import { Link, useGuardedRouter } from "@/state/unsaved-guard";

const NAV = [
  { href: "", label: "Visão geral", icon: LayoutDashboard },
  { href: "/pautas", label: "Pautas", icon: ListChecks },
  { href: "/artigos", label: "Artigos", icon: FileText },
  { href: "/configuracoes", label: "Projeto e configurações", icon: Settings },
];

function ProjectSelect({ projectId, id }: { projectId: string; id: string }) {
  const { projects } = useEditorial();
  const router = useGuardedRouter();
  const pathname = usePathname() ?? "";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Projeto
      </label>
      <select
        id={id}
        className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
        value={projectId}
        onChange={(e) => {
          const next = e.target.value;
          // Mantém a seção atual (pautas, artigos…), mas não a entidade aberta.
          const section = pathname.split("/")[3];
          const keep = section && ["pautas", "artigos", "configuracoes"].includes(section) ? `/${section}` : "";
          try {
            window.localStorage.setItem("mafra-editorial:v1:ultimo-projeto", next);
          } catch (err) {
            console.error("[app-shell] Erro ao lembrar projeto:", err);
          }
          router.push(`/p/${next}${keep}`);
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isDemo ? " (demo)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function Nav({ projectId, onNavigate }: { projectId: string; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const base = `/p/${projectId}`;
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const href = `${base}${item.href}`;
        const active = item.href === "" ? pathname === base : pathname.startsWith(href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:outline-brand-300",
              active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-baseline gap-1.5 px-1">
      <span className="text-[15px] font-extrabold tracking-tight text-white">MAFRA LABS</span>
      <span className="text-[11px] font-medium uppercase tracking-widest text-brand-300">Editorial</span>
    </div>
  );
}

function ReviewerSwitch({ compact = false }: { compact?: boolean }) {
  const { settings, activeReviewer, setActiveReviewer } = useEditorial();
  if (!settings || !activeReviewer) return null;
  const id = compact ? "reviewer-switch-mobile" : "reviewer-switch";
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <UserRound className="h-4 w-4 shrink-0 text-faint" aria-hidden />
      <label htmlFor={id} className={clsx("text-xs text-muted", compact && "sr-only")}>
        Atuando como
      </label>
      <select
        id={id}
        value={activeReviewer.id}
        onChange={(e) => void setActiveReviewer(e.target.value)}
        className="w-full max-w-[12rem] truncate rounded-md border border-line bg-surface py-1 pl-2 pr-6 text-xs text-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
        title="Identificação local da demonstração, sem autenticação"
      >
        {settings.reviewers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} — {ROLE_LABEL[r.role]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DemoModeIndicator({ projectId }: { projectId: string }) {
  return (
    <Link
      href={`/p/${projectId}/configuracoes#modo-demonstracao`}
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
      title="Os dados ficam somente neste navegador. Nenhuma integração está conectada."
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      Modo demonstração — dados locais
    </Link>
  );
}

export function AppShell({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a
        href="#conteudo"
        className="sr-only z-[70] rounded bg-brand-700 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>

      {/* Menu lateral (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-5 bg-slate-900 px-3 py-4 lg:flex">
        <Brand />
        <ProjectSelect projectId={projectId} id="project-select" />
        <Nav projectId={projectId} />
        <div className="mt-auto rounded-md border border-slate-700 px-2.5 py-2 text-[11px] leading-snug text-slate-400">
          Integrações (n8n, Supabase, site/Astro): <span className="font-medium text-slate-200">não conectadas</span>.
        </div>
      </aside>

      {/* Gaveta (celular/tablet) */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col gap-5 bg-slate-900 px-3 py-4">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" className="rounded p-1 text-slate-300 hover:bg-white/10" onClick={() => setDrawer(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ProjectSelect projectId={projectId} id="project-select-mobile" />
            <Nav projectId={projectId} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
            <button
              type="button"
              className="btn-ghost -ml-1 px-2 lg:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Abrir menu"
              aria-expanded={drawer}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <span className="whitespace-nowrap text-sm font-semibold text-ink lg:hidden">MAFRA LABS</span>
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <ReviewerSwitch />
              </div>
              <div className="min-w-0 sm:hidden">
                <ReviewerSwitch compact />
              </div>
              <div className="hidden sm:block">
                <DemoModeIndicator projectId={projectId} />
              </div>
            </div>
          </div>
          <div className="border-t border-line px-3 py-1.5 sm:hidden">
            <DemoModeIndicator projectId={projectId} />
          </div>
        </header>
        <main id="conteudo" tabIndex={-1} className="px-3 py-5 focus-visible:outline-none sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
