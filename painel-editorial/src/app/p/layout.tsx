import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EditorialProvider } from "@/state/editorial";

export const dynamic = "force-dynamic";

/**
 * Modo demonstração (dados locais no navegador). Desligado em produção, a menos
 * que PAINEL_DEMO=1 — assim nenhum dado simulado se mistura aos dados reais.
 */
export default function DemoLayout({ children }: { children: ReactNode }) {
  const enabled = process.env.PAINEL_DEMO === "1" || process.env.NODE_ENV !== "production";
  if (!enabled) notFound();
  return <EditorialProvider>{children}</EditorialProvider>;
}
