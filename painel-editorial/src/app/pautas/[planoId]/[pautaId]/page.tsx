import { PautaView } from "@/components/real/pauta-view";

export default async function PautaPage({ params }: { params: Promise<{ planoId: string; pautaId: string }> }) {
  const { planoId, pautaId } = await params;
  return <PautaView planoId={planoId} pautaId={pautaId} />;
}
