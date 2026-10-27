export type PepAnswer = "sim" | "nao"

export interface PepRow {
  nome: string
  situacao: string
  cargo: string
  de: string
  ate: string
}

export interface DeclaracaoInput {
  nome: string
  rg: string
  cpf: string
  local: string
  pep: PepAnswer
  pepRows: PepRow[]
  consent: boolean
}

export interface Submission {
  id: string
  tokenHash: string
  createdAt: string
  /** Data da declaração (AAAA-MM-DD, fuso de São Paulo) */
  dataDeclaracao: string
  nome: string
  rg: string
  /** Somente dígitos */
  cpf: string
  local: string
  pep: PepAnswer
  pepRows: PepRow[]
  consentAt: string
}

export type SubmissionSummary = Omit<Submission, "tokenHash">

export interface CreateSubmissionResponse {
  id: string
  token: string
  nome: string
}

export interface SubmissionStatusResponse {
  id: string
  nome: string
}

export type FieldErrors = Partial<Record<string, string>>

export interface ApiError {
  error: string
  fields?: FieldErrors
}
