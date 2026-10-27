import type { NextRequest } from "next/server"
import { tokenMatches } from "@/lib/auth"
import { error, json } from "@/lib/http"
import { readSubmission } from "@/lib/storage"
import type { SubmissionStatusResponse } from "@/lib/types"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const s = await readSubmission(id)
    if (!s || !tokenMatches(s, req.nextUrl.searchParams.get("t"))) return error("Link inválido ou expirado.", 404)
    return json<SubmissionStatusResponse>({
      id: s.id,
      nome: s.nome,
      signed: Boolean(s.signed),
      signedAt: s.signed?.uploadedAt ?? null,
    })
  } catch (e) {
    console.error("[api/submissions/[id]] Erro:", e)
    return error("Não foi possível carregar agora. Tente novamente.", 500)
  }
}
