"use client";

import { useParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/ui";
import { useEditorial } from "@/state/editorial";
import { Link } from "@/state/unsaved-guard";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId ?? "";
  const { status, projects, error, hardReset } = useEditorial();

  useEffect(() => {
    if (!projectId) return;
    try {
      window.localStorage.setItem("mafra-editorial:v1:ultimo-projeto", projectId);
    } catch (e) {
      console.error("[layout] Erro ao lembrar projeto:", e);
    }
  }, [projectId]);

  if (status === "loading") {
    return (
      <AppShell projectId={projectId}>
        <LoadingState />
      </AppShell>
    );
  }
  if (status === "error") {
    return (
      <AppShell projectId={projectId}>
        <ErrorState
          title="Não foi possível ler os dados locais"
          action={
            <button type="button" className="btn-secondary" onClick={hardReset}>
              Restaurar dados de demonstração
            </button>
          }
        >
          {error} Restaurar apaga apenas os dados desta demonstração neste navegador.
        </ErrorState>
      </AppShell>
    );
  }
  if (!projects.some((p) => p.id === projectId)) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <ErrorState title="Projeto não encontrado" action={<Link className="btn-secondary" href="/">Abrir um projeto disponível</Link>}>
          O endereço aponta para um projeto que não existe nos dados locais deste navegador.
        </ErrorState>
      </main>
    );
  }
  return <AppShell projectId={projectId}>{children}</AppShell>;
}
