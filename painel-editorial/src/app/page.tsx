"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/ui";
import { useEditorial } from "@/state/editorial";

export default function Home() {
  const { status, projects, error, hardReset } = useEditorial();
  const router = useRouter();

  useEffect(() => {
    if (status !== "ready" || projects.length === 0) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem("mafra-editorial:v1:ultimo-projeto");
    } catch (e) {
      console.error("[home] Erro ao ler último projeto:", e);
    }
    const target = projects.find((p) => p.id === last) ?? projects[0];
    router.replace(`/p/${target.id}`);
  }, [status, projects, router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="mb-6 text-sm font-semibold tracking-tight">MAFRA LABS — Editorial</p>
      {status === "error" ? (
        <ErrorState
          title="Não foi possível abrir os dados locais"
          action={
            <button type="button" className="btn-secondary" onClick={hardReset}>
              Restaurar dados de demonstração
            </button>
          }
        >
          {error}
        </ErrorState>
      ) : (
        <LoadingState label="Abrindo o último projeto…" />
      )}
    </main>
  );
}
