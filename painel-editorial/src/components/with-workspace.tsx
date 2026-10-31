"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import type { ProjectWorkspace } from "@/domain/types";
import { useWorkspace, type WorkspaceHandle } from "@/state/editorial";
import { ErrorState, LoadingState } from "./ui";

/** Carrega o agregado do projeto da URL e cuida dos estados de carregamento/erro. */
export function WithWorkspace({ children }: { children: (ws: ProjectWorkspace, handle: WorkspaceHandle) => ReactNode }) {
  const params = useParams<{ projectId: string }>();
  const handle = useWorkspace(params?.projectId);
  if (handle.status === "loading" && !handle.ws) return <LoadingState />;
  if (handle.status === "error") {
    return (
      <ErrorState
        title="Não foi possível carregar este projeto"
        action={
          <button type="button" className="btn-secondary" onClick={() => void handle.reload()}>
            Tentar novamente
          </button>
        }
      >
        {handle.error}
      </ErrorState>
    );
  }
  if (!handle.ws) return <ErrorState title="Projeto não encontrado nos dados locais." />;
  return <>{children(handle.ws, handle)}</>;
}
