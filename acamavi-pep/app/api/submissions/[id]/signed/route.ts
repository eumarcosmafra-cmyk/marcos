import type { NextRequest } from "next/server"
import { isAdmin, tokenMatches } from "@/lib/auth"
import { error, extensionFor, fileResponse, json } from "@/lib/http"
import { deleteBlobs, readBlobBytes, readSubmission, saveSignedFile, saveSubmission } from "@/lib/storage"
import { cleanText, fileSlug } from "@/lib/validation"

// Limite da plataforma para o corpo da requisição é 4,5 MB; fotos grandes são reduzidas no navegador.
const MAX_BYTES = 4 * 1024 * 1024

function detectType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const s = await readSubmission(id)
    if (!s || !tokenMatches(s, req.nextUrl.searchParams.get("t"))) return error("Link inválido ou expirado.", 404)

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return error("Selecione o arquivo assinado.", 400)
    if (file.size === 0) return error("O arquivo está vazio.", 400)
    if (file.size > MAX_BYTES) return error("Arquivo maior que 4 MB. Envie uma versão menor.", 413)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const contentType = detectType(bytes)
    if (!contentType) return error("Formato não aceito. Envie PDF, JPG ou PNG.", 415)

    const ext = extensionFor(contentType)
    const pathname = await saveSignedFile(s.id, ext, bytes, contentType)
    const previous = s.signed?.pathname
    s.signed = {
      pathname,
      contentType,
      size: bytes.byteLength,
      originalName: cleanText(file.name, 120) || `assinado.${ext}`,
      uploadedAt: new Date().toISOString(),
    }
    await saveSubmission(s)
    if (previous && previous !== pathname) {
      await deleteBlobs([previous]).catch((e: unknown) => console.error("[api/signed] Erro ao apagar arquivo antigo:", e))
    }
    return json({ ok: true, signedAt: s.signed.uploadedAt })
  } catch (e) {
    console.error("[api/submissions/[id]/signed] Erro no envio:", e)
    return error("Não foi possível enviar agora. Tente novamente.", 500)
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    if (!(await isAdmin())) return error("Não autorizado.", 401)
    const s = await readSubmission(id)
    if (!s?.signed) return error("Documento assinado não encontrado.", 404)
    const file = await readBlobBytes(s.signed.pathname)
    if (!file) return error("Documento assinado não encontrado.", 404)
    const ext = extensionFor(s.signed.contentType)
    return fileResponse(file.bytes, s.signed.contentType, `Declaracao_PEP_${fileSlug(s.nome)}_assinada.${ext}`)
  } catch (e) {
    console.error("[api/submissions/[id]/signed] Erro no download:", e)
    return error("Não foi possível baixar agora.", 500)
  }
}
