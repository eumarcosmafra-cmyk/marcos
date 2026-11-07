import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { RealShell } from "@/components/real/real-shell";
import { podeDecidir } from "@/server/auth/session";
import { currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

export default async function FilaLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/entrar?voltar=/fila");
  return <RealShell user={{ nome: user.nome, papel: user.papel, pode_decidir: podeDecidir(user) }}>{children}</RealShell>;
}
