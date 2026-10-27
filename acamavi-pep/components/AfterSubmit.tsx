"use client"

import { useEffect, useRef, useState } from "react"
import type { ApiError } from "@/lib/types"

const MAX_UPLOAD = 4 * 1024 * 1024
const COMPRESS_ABOVE = 2.5 * 1024 * 1024
const GOVBR_URL = "https://www.gov.br/pt-br/servicos/assinatura-eletronica"

/** Reduz fotos grandes (ou formatos como HEIC) para JPEG antes do envio. */
async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return file
  const isJpegOrPng = file.type === "image/jpeg" || file.type === "image/png"
  if (isJpegOrPng && file.size <= COMPRESS_ABOVE) return file

  const bitmap = await createImageBitmap(file)
  const maxSide = 2400
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas indisponível")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
  if (!blob) throw new Error("Falha ao converter imagem")
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
  return new File([blob], name, { type: "image/jpeg" })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  id: string
  token: string
  nome: string
  signedAt: string | null
}

export function AfterSubmit({ id, token, nome, signedAt: initialSignedAt }: Props) {
  const [signedAt, setSignedAt] = useState<string | null>(initialSignedAt)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [returnLink, setReturnLink] = useState("")
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const pdfHref = `/api/submissions/${id}/pdf?t=${encodeURIComponent(token)}`
  const firstName = nome.split(" ")[0]

  useEffect(() => {
    setReturnLink(`${window.location.origin}/enviar/${id}?t=${encodeURIComponent(token)}`)
  }, [id, token])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0]
    e.target.value = ""
    if (!original) return
    setUploadError(null)
    setUploading(true)
    try {
      let file: File
      try {
        file = await prepareFile(original)
      } catch (err) {
        console.error("[AfterSubmit] Erro ao preparar arquivo:", err)
        setUploadError("Não conseguimos ler esse arquivo. Envie um PDF, JPG ou PNG.")
        return
      }
      if (file.size > MAX_UPLOAD) {
        setUploadError("Arquivo maior que 4 MB. Envie uma versão menor (ou uma foto em vez do escaneamento).")
        return
      }
      const body = new FormData()
      body.append("file", file)
      const res = await fetch(`/api/submissions/${id}/signed?t=${encodeURIComponent(token)}`, { method: "POST", body })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null
        setUploadError(data?.error ?? "Não foi possível enviar. Tente novamente.")
        return
      }
      const data = (await res.json()) as { signedAt: string }
      setSignedAt(data.signedAt)
    } catch (err) {
      console.error("[AfterSubmit] Erro no envio:", err)
      setUploadError("Falha de conexão. Verifique a internet e tente novamente.")
    } finally {
      setUploading(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(returnLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error("[AfterSubmit] Erro ao copiar link:", err)
    }
  }

  return (
    <>
      <section className="card">
        <div className="alert alert-ok">Pronto, {firstName}! Sua declaração foi preenchida.</div>
        <h2>1. Baixe sua declaração</h2>
        <a className="btn btn-block" href={pdfHref} download>
          Baixar declaração (PDF)
        </a>
      </section>

      <section className="card">
        <h2>2. Assine o documento</h2>
        <p className="lead" style={{ marginBottom: 12 }}>
          Escolha a forma que preferir:
        </p>

        <div className="option">
          <h3>
            Assinar pelo gov.br <span className="badge">mais rápido</span>
          </h3>
          <ol>
            <li>
              Acesse o{" "}
              <a href={GOVBR_URL} target="_blank" rel="noopener noreferrer">
                serviço de assinatura eletrônica do gov.br
              </a>{" "}
              ou o app gov.br (opção &quot;Assinar documentos digitalmente&quot;).
            </li>
            <li>Entre com sua conta gov.br (precisa ser nível prata ou ouro).</li>
            <li>Envie o PDF que você baixou e posicione a assinatura sobre a linha &quot;Assinatura&quot;.</li>
            <li>Confirme com o código que chega no app gov.br.</li>
            <li>
              Baixe o arquivo assinado pelo botão de download do gov.br. Não use &quot;imprimir/salvar como PDF&quot;: isso
              apaga a assinatura digital.
            </li>
          </ol>
        </div>

        <div className="option">
          <h3>Imprimir e assinar à mão</h3>
          <ol>
            <li>Imprima o PDF.</li>
            <li>Assine com caneta sobre a linha &quot;Assinatura&quot;.</li>
            <li>Tire uma foto nítida da folha inteira (bem iluminada, sem cortes) ou escaneie.</li>
          </ol>
        </div>
      </section>

      <section className="card">
        <h2>3. Envie o documento assinado</h2>
        {signedAt && (
          <div className="alert alert-ok">
            Documento assinado recebido em {formatDateTime(signedAt)}. Obrigado! Se precisar, você pode enviar outro
            arquivo para substituir.
          </div>
        )}
        {uploadError && <div className="alert alert-error">{uploadError}</div>}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/*"
          onChange={handleFile}
          hidden
        />
        <button className="btn btn-block" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? "Enviando…" : signedAt ? "Enviar outro arquivo" : "Enviar documento assinado"}
        </button>
        <p className="hint" style={{ marginTop: 8 }}>
          PDF assinado pelo gov.br, ou foto/escaneamento do papel assinado (PDF, JPG ou PNG, até 4 MB).
        </p>
      </section>

      {!signedAt && (
        <section className="card">
          <h2>Vai assinar depois?</h2>
          <p className="lead" style={{ marginBottom: 10 }}>
            Guarde este link. Por ele você baixa o PDF de novo e envia o documento assinado quando quiser. Não compartilhe:
            ele dá acesso aos seus dados.
          </p>
          <div className="copy-row">
            <input type="text" readOnly value={returnLink} aria-label="Link pessoal" onFocus={(e) => e.target.select()} />
            <button className="btn btn-secondary btn-small" type="button" onClick={copyLink}>
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>
      )}
    </>
  )
}
