import type { NextRequest } from "next/server"
import { isAdmin, tokenMatches } from "@/lib/auth"
import { error, fileResponse } from "@/lib/http"
import { generateDeclaracaoPdf } from "@/lib/pdf"
import { readSubmission } from "@/lib/storage"
import { fileSlug } from "@/lib/validation"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const s = await readSubmission(id)
    if (!s) return error("Declaração não encontrada.", 404)
    const allowed = tokenMatches(s, req.nextUrl.searchParams.get("t")) || (await isAdmin())
    if (!allowed) return error("Declaração não encontrada.", 404)

    const pdf = await generateDeclaracaoPdf(s)
    return fileResponse(pdf, "application/pdf", `Declaracao_PEP_${fileSlug(s.nome)}.pdf`)
  } catch (e) {
    console.error("[api/submissions/[id]/pdf] Erro:", e)
    return error("Não foi possível gerar o PDF agora. Tente novamente.", 500)
  }
}
