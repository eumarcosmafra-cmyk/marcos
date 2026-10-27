"use client"

import { useEffect, useState } from "react"
import * as T from "@/lib/document-text"
import type { ApiError, CreateSubmissionResponse, FieldErrors, PepAnswer, PepRow } from "@/lib/types"
import { MAX_PEP_ROWS, emptyPepRow, maskCpf, validateDeclaracao } from "@/lib/validation"
import { DownloadDeclaracao } from "./DownloadDeclaracao"

const STORAGE_KEY = "acamavi_pep_ultima"

function readSaved(): CreateSubmissionResponse | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<CreateSubmissionResponse>
    return data.id && data.token && data.nome ? (data as CreateSubmissionResponse) : null
  } catch (e) {
    console.error("[DeclaracaoForm] Erro ao ler localStorage:", e)
    return null
  }
}

function writeSaved(data: CreateSubmissionResponse | null) {
  try {
    if (data) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error("[DeclaracaoForm] Erro ao gravar localStorage:", e)
  }
}

export function DeclaracaoForm() {
  const [nome, setNome] = useState("")
  const [rg, setRg] = useState("")
  const [cpf, setCpf] = useState("")
  const [local, setLocal] = useState("")
  const [pep, setPep] = useState<PepAnswer | "">("")
  const [rows, setRows] = useState<PepRow[]>([emptyPepRow()])
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CreateSubmissionResponse | null>(null)
  const [saved, setSaved] = useState<CreateSubmissionResponse | null>(null)

  useEffect(() => {
    setSaved(readSaved())
  }, [])

  function updateRow(index: number, key: keyof PepRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const payload = { nome, rg, cpf, local, pep, pepRows: pep === "sim" ? rows : [], consent, website }
    const check = validateDeclaracao(payload)
    if (!check.ok) {
      setErrors(check.errors)
      const first = document.querySelector("[data-field-error]")
      first?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setErrors({})
    setSubmitting(true)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null
        if (data?.fields) setErrors(data.fields)
        setServerError(data?.error ?? "Não foi possível enviar. Tente novamente.")
        return
      }
      const data = (await res.json()) as CreateSubmissionResponse
      writeSaved(data)
      setResult(data)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      console.error("[DeclaracaoForm] Erro no envio:", err)
      setServerError("Falha de conexão. Verifique a internet e tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return <DownloadDeclaracao id={result.id} token={result.token} nome={result.nome} />
  }

  const err = (key: string) =>
    errors[key] ? (
      <div className="error-text" data-field-error>
        {errors[key]}
      </div>
    ) : null

  return (
    <>
      <section className="card">
        <h1>Declaração de Pessoa Politicamente Exposta</h1>
        <p className="lead">Pessoa física. Leva cerca de 2 minutos.</p>
        <ol className="steps">
          <li>Preencha seus dados abaixo.</li>
          <li>Baixe a declaração já preenchida (PDF).</li>
          <li>Imprima, assine à mão e entregue à ACAMAVI.</li>
        </ol>
      </section>

      {saved && (
        <div className="alert alert-info">
          Você já preencheu uma declaração neste aparelho ({saved.nome}).{" "}
          <a href={`/declaracao/${saved.id}?t=${encodeURIComponent(saved.token)}`}>Baixar de novo</a>
          {" · "}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              writeSaved(null)
              setSaved(null)
            }}
          >
            Preencher uma nova
          </button>
        </div>
      )}

      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2>Seus dados</h2>

        <div className="field">
          <label htmlFor="nome">Nome completo</label>
          <input
            id="nome"
            type="text"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={errors.nome ? "invalid" : undefined}
          />
          {err("nome")}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="rg">
              RG <span className="hint">Número e órgão emissor. Ex.: 1.234.567 SSP/SC</span>
            </label>
            <input
              id="rg"
              type="text"
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              className={errors.rg ? "invalid" : undefined}
            />
            {err("rg")}
          </div>
          <div className="field">
            <label htmlFor="cpf">
              CPF <span className="hint">Somente números</span>
            </label>
            <input
              id="cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className={errors.cpf ? "invalid" : undefined}
            />
            {err("cpf")}
          </div>
        </div>

        <div className="field">
          <label htmlFor="local">
            Cidade <span className="hint">Vai no campo &quot;Local e data&quot;. A data é preenchida automaticamente.</span>
          </label>
          <input
            id="local"
            type="text"
            autoComplete="address-level2"
            placeholder="Ex.: Rio do Sul/SC"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className={errors.local ? "invalid" : undefined}
          />
          {err("local")}
        </div>

        <div className="hp" aria-hidden="true">
          <label htmlFor="website">Não preencha</label>
          <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <h2 style={{ marginTop: 8 }}>Pessoa politicamente exposta</h2>
        <p className="hint" style={{ marginBottom: 8 }}>
          É pessoa politicamente exposta quem, nos últimos 5 anos, exerceu cargo, emprego ou função pública relevante, ou
          cujos familiares (pais, filhos, cônjuge, companheiro(a), enteados), representantes ou pessoas de relacionamento
          próximo exerceram. Exemplos: mandato eletivo federal, ministro de Estado, governador, prefeito ou presidente de
          Câmara de capital, membros de tribunais superiores.
        </p>
        <details>
          <summary>Ver a lista completa de cargos</summary>
          <p>
            <strong>{T.PARA_BRASILEIROS}</strong>
          </p>
          <ol type="I">
            {T.LISTA_BRASILEIROS.map((item) => (
              <li key={item.rotulo}>
                {item.texto}
                {item.subitens && (
                  <ol type="a">
                    {item.subitens.map((s) => (
                      <li key={s.rotulo}>{s.texto}</li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
          <p>
            <strong>{T.PARA_ESTRANGEIROS}</strong> {T.TEXTO_ESTRANGEIROS}
          </p>
          <p>{T.CARACTERIZACAO_3}</p>
          <p>{T.CARACTERIZACAO_4}</p>
        </details>

        <div className="field" role="radiogroup" aria-label="Condição de pessoa politicamente exposta">
          <label className={`choice${pep === "sim" ? " selected" : ""}`}>
            <input type="radio" name="pep" value="sim" checked={pep === "sim"} onChange={() => setPep("sim")} />
            <span>{T.OPCAO_SIM}</span>
          </label>
          <label className={`choice${pep === "nao" ? " selected" : ""}`}>
            <input type="radio" name="pep" value="nao" checked={pep === "nao"} onChange={() => setPep("nao")} />
            <span>{T.OPCAO_NAO}</span>
          </label>
          {err("pep")}
        </div>

        {pep === "sim" && (
          <div className="field">
            <span className="label">Quem exerce ou exerceu o cargo</span>
            <p className="hint" style={{ marginBottom: 10 }}>
              Pode ser você mesmo ou o familiar/pessoa próxima. Até {MAX_PEP_ROWS} pessoas.
            </p>
            {rows.map((row, i) => (
              <div className="pep-row" key={i}>
                <div className="pep-row-head">
                  <span>Pessoa {i + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn-link btn-danger-link"
                      onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="field">
                  <label htmlFor={`row-${i}-nome`}>Nome</label>
                  <input id={`row-${i}-nome`} type="text" value={row.nome} onChange={(e) => updateRow(i, "nome", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`row-${i}-situacao`}>
                    Situação <span className="hint">Ex.: proponente, esposa do proponente, procurador do proponente</span>
                  </label>
                  <input
                    id={`row-${i}-situacao`}
                    type="text"
                    value={row.situacao}
                    onChange={(e) => updateRow(i, "situacao", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`row-${i}-cargo`}>Cargo / emprego / função pública</label>
                  <input id={`row-${i}-cargo`} type="text" value={row.cargo} onChange={(e) => updateRow(i, "cargo", e.target.value)} />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label htmlFor={`row-${i}-de`}>
                      De <span className="hint">mês/ano</span>
                    </label>
                    <input id={`row-${i}-de`} type="text" placeholder="01/2021" value={row.de} onChange={(e) => updateRow(i, "de", e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={`row-${i}-ate`}>
                      Até <span className="hint">mês/ano ou &quot;atual&quot;</span>
                    </label>
                    <input id={`row-${i}-ate`} type="text" placeholder="12/2024" value={row.ate} onChange={(e) => updateRow(i, "ate", e.target.value)} />
                  </div>
                </div>
                {err(`pepRows.${i}`)}
              </div>
            ))}
            {rows.length < MAX_PEP_ROWS && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setRows((prev) => [...prev, emptyPepRow()])}>
                + Adicionar pessoa
              </button>
            )}
            {err("pepRows")}
          </div>
        )}

        <div className="field" style={{ marginTop: 20 }}>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Autorizo a {T.ASSOCIACAO_SIGLA} a usar os dados acima exclusivamente para gerar e apresentar esta declaração
              (Lei 13.709/2018 – LGPD). Os dados ficam em ambiente privado e serão apagados ao fim da coleta.
            </span>
          </label>
          {err("consent")}
        </div>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button className="btn btn-block" type="submit" disabled={submitting}>
          {submitting ? "Gerando…" : "Gerar minha declaração"}
        </button>
      </form>
    </>
  )
}
