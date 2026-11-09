/** Parser de CSV com ; e aspas (formato das planilhas geradas e da exportação Magazord). */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = []
  let campo = ""
  let linha: string[] = []
  let aspas = false
  const t = texto.replace(/^﻿/, "")
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === ";") {
      linha.push(campo)
      campo = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ""
    } else campo += c
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  const [cab, ...resto] = linhas
  return resto.filter((l) => l.some((x) => x !== "")).map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])))
}
