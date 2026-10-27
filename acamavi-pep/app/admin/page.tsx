"use client"

import { useCallback, useEffect, useState } from "react"
import { strToU8, zipSync, type Zippable } from "fflate"
import { Brand } from "@/components/Brand"
import type { ApiError, SubmissionSummary } from "@/lib/types"
import { fileSlug, formatCpf } from "@/lib/validation"

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

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-")
  return `${d}/${m}/${y}`
}

function csvCell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function buildCsv(list: SubmissionSummary[]): string {
  const header = [
    "Nome",
    "RG",
    "CPF",
    "Local",
    "Data da declaração",
    "PEP",
    "Pessoas informadas (PEP)",
    "Preenchido em",
    "Documento assinado enviado",
    "Assinado enviado em",
  ]
  const rows = list.map((s) => [
    s.nome,
    s.rg,
    formatCpf(s.cpf),
    s.local,
    formatDate(s.dataDeclaracao),
    s.pep === "sim" ? "SIM" : "NÃO",
    s.pepRows
      .map((r) => {
        const periodo = r.de || r.ate ? `${r.de || "?"} a ${r.ate || "?"}` : ""
        return [r.nome, r.situacao, r.cargo, periodo].filter(Boolean).join(" | ")
      })
      .join(" / "),
    formatDateTime(s.createdAt),
    s.signed ? "Sim" : "Não",
    s.signed ? formatDateTime(s.signed.uploadedAt) : "",
  ])
  // BOM + ";" para o Excel em português abrir com acentos e colunas corretas
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n")
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`${res.status} em ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

function baseName(s: SubmissionSummary): string {
  return `${fileSlug(s.nome)}_${s.id.slice(0, 6)}`
}

function extOf(contentType: string): string {
  if (contentType === "application/pdf") return "pdf"
  if (contentType === "image/png") return "png"
  return "jpg"
}

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "login" | "ready">("loading")
  const [list, setList] = useState<SubmissionSummary[]>([])
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/submissions", { cache: "no-store" })
      if (res.status === 401) {
        setState("login")
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null
        setError(data?.error ?? "Erro ao carregar.")
        setState("ready")
        return
      }
      setList((await res.json()) as SubmissionSummary[])
      setState("ready")
    } catch (e) {
      console.error("[admin] Erro ao carregar:", e)
      setError("Falha de conexão.")
      setState("ready")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null
        setError(data?.error ?? "Não foi possível entrar.")
        return
      }
      setPassword("")
      setState("loading")
      await load()
    } catch (err) {
      console.error("[admin] Erro no login:", err)
      setError("Falha de conexão.")
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" })
    } catch (e) {
      console.error("[admin] Erro ao sair:", e)
    }
    setList([])
    setState("login")
  }

  async function remove(s: SubmissionSummary) {
    if (!window.confirm(`Excluir definitivamente a declaração de ${s.nome}? Isso apaga também o documento assinado.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/submissions/${s.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null
        setError(data?.error ?? "Não foi possível excluir.")
        return
      }
      await load()
    } catch (e) {
      console.error("[admin] Erro ao excluir:", e)
      setError("Falha de conexão.")
    } finally {
      setBusy(false)
    }
  }

  function downloadCsv() {
    downloadBlob(new Blob([buildCsv(list)], { type: "text/csv;charset=utf-8" }), "acamavi-declaracoes-pep.csv")
  }

  async function downloadZip() {
    setBusy(true)
    setError(null)
    try {
      const files: Zippable = { "dados.csv": strToU8(buildCsv(list)) }
      const tasks: { label: string; run: () => Promise<void> }[] = []
      for (const s of list) {
        tasks.push({
          label: s.nome,
          run: async () => {
            files[`declaracoes-preenchidas/${baseName(s)}.pdf`] = await fetchBytes(`/api/submissions/${s.id}/pdf`)
          },
        })
        if (s.signed) {
          const signed = s.signed
          tasks.push({
            label: s.nome,
            run: async () => {
              files[`declaracoes-assinadas/${baseName(s)}.${extOf(signed.contentType)}`] = await fetchBytes(
                `/api/submissions/${s.id}/signed`,
              )
            },
          })
        }
      }
      let done = 0
      const queue = [...tasks]
      const worker = async () => {
        for (let t = queue.shift(); t; t = queue.shift()) {
          await t.run()
          done++
          setProgress(`Preparando arquivos: ${done}/${tasks.length}`)
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker))
      setProgress("Compactando…")
      // PDFs e fotos já são comprimidos: só armazenar
      const zipped = zipSync(files, { level: 0 })
      const stamp = new Date().toISOString().slice(0, 10)
      downloadBlob(new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" }), `acamavi-declaracoes-pep-${stamp}.zip`)
    } catch (e) {
      console.error("[admin] Erro ao gerar ZIP:", e)
      setError("Falha ao gerar o ZIP. Tente de novo.")
    } finally {
      setProgress(null)
      setBusy(false)
    }
  }

  if (state === "loading") {
    return (
      <main className="wrap">
        <Brand />
        <section className="card">Carregando…</section>
      </main>
    )
  }

  if (state === "login") {
    return (
      <main className="wrap">
        <Brand />
        <form className="card" onSubmit={login}>
          <h1>Área administrativa</h1>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-block" type="submit" disabled={busy || !password}>
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    )
  }

  const signedCount = list.filter((s) => s.signed).length
  const pepCount = list.filter((s) => s.pep === "sim").length

  return (
    <main className="wrap wrap-wide">
      <Brand />
      <section className="card">
        <h1>Declarações recebidas</h1>
        <div className="stats">
          <span>
            <strong>{list.length}</strong> preenchidas
          </span>
          <span>
            <strong>{signedCount}</strong> com documento assinado
          </span>
          <span>
            <strong>{list.length - signedCount}</strong> aguardando assinatura
          </span>
          <span>
            <strong>{pepCount}</strong> marcaram SIM (PEP)
          </span>
        </div>
        <div className="toolbar">
          <button className="btn" type="button" onClick={downloadZip} disabled={busy || list.length === 0}>
            {progress ?? "Baixar tudo (.zip)"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={downloadCsv} disabled={busy || list.length === 0}>
            Baixar planilha (.csv)
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => void load()} disabled={busy}>
            Atualizar
          </button>
          <button className="btn btn-secondary" type="button" onClick={logout} disabled={busy}>
            Sair
          </button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {list.length === 0 ? (
          <p className="lead">Nenhuma declaração ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>PEP</th>
                  <th>Preenchido em</th>
                  <th>Assinado</th>
                  <th>Arquivos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nome}</td>
                    <td>{formatCpf(s.cpf)}</td>
                    <td>{s.pep === "sim" ? "SIM" : "NÃO"}</td>
                    <td>{formatDateTime(s.createdAt)}</td>
                    <td>
                      {s.signed ? (
                        <span className="tag-ok">Sim · {formatDateTime(s.signed.uploadedAt)}</span>
                      ) : (
                        <span className="tag-pending">Aguardando</span>
                      )}
                    </td>
                    <td className="wrap-cell">
                      <a href={`/api/submissions/${s.id}/pdf`}>PDF preenchido</a>
                      {s.signed && (
                        <>
                          {" · "}
                          <a href={`/api/submissions/${s.id}/signed`}>Assinado</a>
                        </>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn-link btn-danger-link" onClick={() => remove(s)} disabled={busy}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
