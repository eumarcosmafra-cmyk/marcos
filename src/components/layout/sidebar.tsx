"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  MessageSquare,
  Settings,
  TrendingUp,
  Globe,
  Zap,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analysis", label: "Analista IA", icon: MessageSquare },
  { href: "/analysis/audit", label: "Auditoria SEO", icon: Search },
  { href: "/analysis/keywords", label: "Keywords", icon: TrendingUp },
  { href: "/analysis/competitors", label: "Concorrentes", icon: Globe },
  { href: "/opportunities", label: "Oportunidades", icon: Zap },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/reports", label: "Relatórios", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col transition-colors duration-300"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--glass-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 py-5"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            SEO Analyst
          </h1>
          <p
            className="text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            AI-Powered Senior SEO
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive ? "sidebar-link-active" : "sidebar-link"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid var(--glass-border)" }}
      >
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="sidebar-link mb-1 w-full"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === "dark" ? "Tema Claro" : "Tema Escuro"}
        </button>

        <Link href="/settings" className="sidebar-link">
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
        <div className="mt-3 rounded-lg bg-brand-600/10 px-3 py-2">
          <p className="text-[10px] font-medium text-brand-400">
            Powered by Claude AI
          </p>
          <p
            className="text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            Analista SEO Sênior
          </p>
        </div>
      </div>
    </aside>
  );
}
