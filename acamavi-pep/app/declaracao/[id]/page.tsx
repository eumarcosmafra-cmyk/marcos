"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Brand } from "@/components/Brand"
import { DownloadDeclaracao } from "@/components/DownloadDeclaracao"
import type { ApiError, SubmissionStatusResponse } from "@/lib/types"

function DeclaracaoContent() {
  const { id } = useParams<{ id: string }>()
  const token = useSearchParams().get("t") ?? ""
  const [status, setStatus] = useState<SubmissionStatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/submissions/${id}?t=${encodeURIComponent(token)}`, { cache: "no-store" })
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as ApiError | null
          if (!cancelled) setError(data?.error ?? "Link inválido.")
          return
        }
        const data = (await res.json()) as SubmissionStatusResponse
        if (!cancelled) setStatus(data)
      } catch (e) {
        console.error("[declaracao] Erro ao carregar:", e)
        if (!cancelled) setError("Falha de conexão. Recarregue a página.")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, token])

  if (error) {
    return (
      <section className="card">
        <div className="alert alert-error">{error}</div>
        <a href="/">Preencher a declaração</a>
      </section>
    )
  }
  if (!status) return <section className="card">Carregando…</section>
  return <DownloadDeclaracao id={status.id} token={token} nome={status.nome} />
}

export default function DeclaracaoPage() {
  return (
    <main className="wrap">
      <Brand />
      <Suspense fallback={<section className="card">Carregando…</section>}>
        <DeclaracaoContent />
      </Suspense>
    </main>
  )
}
