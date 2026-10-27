import { newId, newToken, hashToken } from "@/lib/auth"
import { error, json } from "@/lib/http"
import { saveSubmission } from "@/lib/storage"
import type { CreateSubmissionResponse, Submission } from "@/lib/types"
import { todayInSaoPaulo, validateDeclaracao } from "@/lib/validation"

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch (e) {
    console.error("[api/submissions] JSON inválido:", e)
    return error("Requisição inválida.", 400)
  }

  // Campo invisível para robôs: pessoas nunca preenchem
  const honeypot = (body as Record<string, unknown> | null)?.website
  if (typeof honeypot === "string" && honeypot.trim()) return error("Requisição inválida.", 400)

  const result = validateDeclaracao(body)
  if (!result.ok) return error("Confira os campos destacados.", 422, result.errors)

  const now = new Date()
  const token = newToken()
  const { consent: _consent, ...data } = result.value
  const submission: Submission = {
    id: newId(),
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    dataDeclaracao: todayInSaoPaulo(now),
    ...data,
    consentAt: now.toISOString(),
    signed: null,
  }

  try {
    await saveSubmission(submission)
  } catch (e) {
    console.error("[api/submissions] Erro ao salvar:", e)
    return error("Não foi possível salvar agora. Tente novamente em instantes.", 500)
  }

  return json<CreateSubmissionResponse>({ id: submission.id, token, nome: submission.nome }, 201)
}
