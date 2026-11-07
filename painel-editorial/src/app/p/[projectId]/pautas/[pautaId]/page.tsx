"use client";

import { useParams } from "next/navigation";
import { PautaDetail } from "@/components/views/pauta-detail";
import { WithWorkspace } from "@/components/with-workspace";
import { ErrorState } from "@/components/ui";
import { Link } from "@/state/unsaved-guard";

export default function PautaPage() {
  const params = useParams<{ projectId: string; pautaId: string }>();
  return (
    <WithWorkspace>
      {(ws, handle) => {
        const pauta = ws.pautas.find((p) => p.id === params?.pautaId);
        if (!pauta) {
          return (
            <ErrorState title="Pauta não encontrada neste projeto" action={<Link className="btn-secondary" href={`/p/${ws.project.id}/pautas`}>Voltar às pautas</Link>}>
              Ela pode pertencer a outro projeto ou ter sido removida ao restaurar a demonstração.
            </ErrorState>
          );
        }
        return <PautaDetail key={pauta.id} ws={ws} pauta={pauta} execute={handle.execute} />;
      }}
    </WithWorkspace>
  );
}
