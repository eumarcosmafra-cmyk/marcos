import { isAdmin } from "@/lib/auth"
import { error, json } from "@/lib/http"
import { deleteSubmission, readSubmission } from "@/lib/storage"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    if (!(await isAdmin())) return error("Não autorizado.", 401)
    const s = await readSubmission(id)
    if (!s) return error("Registro não encontrado.", 404)
    await deleteSubmission(s)
    return json({ ok: true })
  } catch (e) {
    console.error("[api/admin/submissions/[id]] Erro ao excluir:", e)
    return error("Não foi possível excluir.", 500)
  }
}
