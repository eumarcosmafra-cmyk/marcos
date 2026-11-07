"use client";

import { useMemo } from "react";
import type { ProjectWorkspace } from "@/domain/types";
import type { WorkspaceHandle } from "@/state/editorial";
import { useGuardedRouter } from "@/state/unsaved-guard";
import { PageHeader } from "@/components/ui";
import { emptyPautaInput, PautaForm } from "./pauta-form";

export function PautaEditor({ ws, execute }: { ws: ProjectWorkspace; execute: WorkspaceHandle["execute"] }) {
  const router = useGuardedRouter();
  const base = `/p/${ws.project.id}`;
  const clusters = useMemo(() => Array.from(new Set(ws.pautas.map((p) => p.cluster).filter(Boolean))).sort(), [ws.pautas]);
  const initial = useMemo(() => emptyPautaInput(), []);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={ws.project.name}
        title="Nova pauta"
        description="Criada manualmente, entra como “Pauta sugerida”. Ela é registrada apenas neste projeto."
      />
      <PautaForm
        guardKey="pauta-nova"
        initial={initial}
        clusters={clusters}
        submitLabel="Criar pauta"
        onCancel={() => router.push(`${base}/pautas`)}
        onSubmit={async (input) => {
          const r = await execute({ type: "pauta.create", input });
          if (r.ok && r.createdId) router.pushUnchecked(`${base}/pautas/${r.createdId}`);
          return r.ok;
        }}
      />
    </div>
  );
}
