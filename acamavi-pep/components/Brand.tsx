import { ASSOCIACAO_NOME, ASSOCIACAO_SIGLA } from "@/lib/document-text"

export function Brand() {
  return (
    <header className="brand">
      <p className="brand-sigla">{ASSOCIACAO_SIGLA}</p>
      <p className="brand-nome">{ASSOCIACAO_NOME}</p>
    </header>
  )
}
