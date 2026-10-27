import { isAdmin } from "@/lib/auth"
import { error, json } from "@/lib/http"
import { listSubmissions } from "@/lib/storage"
import type { SubmissionSummary } from "@/lib/types"

export async function GET() {
  try {
    if (!(await isAdmin())) return error("Não autorizado.", 401)
    const all = await listSubmissions()
    const summaries: SubmissionSummary[] = all
      .map(({ tokenHash: _tokenHash, ...rest }) => rest)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    return json(summaries)
  } catch (e) {
    console.error("[api/admin/submissions] Erro:", e)
    return error("Não foi possível carregar a lista.", 500)
  }
}
