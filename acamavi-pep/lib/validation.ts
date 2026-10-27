import type { DeclaracaoInput, FieldErrors, PepAnswer, PepRow } from "./types"

export const MAX_PEP_ROWS = 5

const LIMITS = {
  nome: 120,
  rg: 30,
  local: 80,
  cell: 80,
  periodo: 20,
} as const

/** Normaliza texto livre: NFC, sem caracteres de controle, espaços colapsados. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function isValidCpf(raw: string): boolean {
  const cpf = onlyDigits(raw)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digits = cpf.split("").map(Number)
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += digits[i] * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === digits[9] && check(10) === digits[10]
}

export function formatCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length !== 11) return d
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Máscara progressiva para o campo de CPF enquanto a pessoa digita. */
export function maskCpf(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2")
}

export function emptyPepRow(): PepRow {
  return { nome: "", situacao: "", cargo: "", de: "", ate: "" }
}

function cleanRow(row: unknown): PepRow {
  const r = (row ?? {}) as Record<string, unknown>
  return {
    nome: cleanText(r.nome, LIMITS.cell),
    situacao: cleanText(r.situacao, LIMITS.cell),
    cargo: cleanText(r.cargo, LIMITS.cell),
    de: cleanText(r.de, LIMITS.periodo),
    ate: cleanText(r.ate, LIMITS.periodo),
  }
}

function rowIsEmpty(r: PepRow): boolean {
  return !r.nome && !r.situacao && !r.cargo && !r.de && !r.ate
}

export type ValidationResult =
  | { ok: true; value: DeclaracaoInput }
  | { ok: false; errors: FieldErrors }

export function validateDeclaracao(raw: unknown): ValidationResult {
  const body = (raw ?? {}) as Record<string, unknown>
  const errors: FieldErrors = {}

  const nome = cleanText(body.nome, LIMITS.nome)
  const rg = cleanText(body.rg, LIMITS.rg)
  const cpf = onlyDigits(typeof body.cpf === "string" ? body.cpf : "")
  const local = cleanText(body.local, LIMITS.local)
  const pep: PepAnswer | null = body.pep === "sim" || body.pep === "nao" ? body.pep : null
  const consent = body.consent === true

  if (nome.split(" ").filter(Boolean).length < 2) errors.nome = "Informe seu nome completo."
  if (rg.length < 3) errors.rg = "Informe o número do seu RG."
  if (!isValidCpf(cpf)) errors.cpf = "CPF inválido. Confira os números."
  if (local.length < 2) errors.local = "Informe a cidade onde você está assinando."
  if (!pep) errors.pep = "Marque SIM ou NÃO."
  if (!consent) errors.consent = "É preciso autorizar o uso dos dados para gerar a declaração."

  let pepRows: PepRow[] = []
  if (pep === "sim") {
    const rows = Array.isArray(body.pepRows) ? body.pepRows.slice(0, MAX_PEP_ROWS) : []
    pepRows = rows.map(cleanRow).filter((r) => !rowIsEmpty(r))
    if (pepRows.length === 0) {
      errors.pepRows = "Como você marcou SIM, preencha pelo menos uma linha do quadro."
    } else {
      pepRows.forEach((r, i) => {
        if (!r.nome || !r.situacao || !r.cargo) {
          errors[`pepRows.${i}`] = "Preencha nome, situação e cargo/função."
        }
      })
    }
  }

  if (Object.keys(errors).length > 0 || !pep) return { ok: false, errors }
  return { ok: true, value: { nome, rg, cpf, local, pep, pepRows, consent } }
}

/** Data AAAA-MM-DD no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

/** "2026-10-27" → "27 de outubro de 2026" */
export function dataPorExtenso(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

/** Nome de arquivo ASCII seguro: "Maria José da Silva" → "Maria_Jose_da_Silva" */
export function fileSlug(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "declaracao"
  )
}
