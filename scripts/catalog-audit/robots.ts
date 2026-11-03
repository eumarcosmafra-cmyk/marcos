interface Regra {
  permitir: boolean
  padrao: RegExp
  tamanho: number
}

/**
 * Parser mínimo de robots.txt: grupo do user-agent específico ou "*",
 * curingas `*` e `$`, regra mais longa vence (como o Google).
 */
export class Robots {
  private constructor(private readonly regras: Regra[]) {}

  static interpretar(texto: string, tokenAgente: string): Robots {
    const grupos = new Map<string, Regra[]>()
    let agentesAtuais: string[] = []
    let ultimaFoiAgente = false

    for (const linhaBruta of texto.split(/\r?\n/)) {
      const linha = linhaBruta.replace(/#.*/, "").trim()
      if (!linha) continue
      const sep = linha.indexOf(":")
      if (sep < 0) continue
      const chave = linha.slice(0, sep).trim().toLowerCase()
      const valor = linha.slice(sep + 1).trim()

      if (chave === "user-agent") {
        if (!ultimaFoiAgente) agentesAtuais = []
        agentesAtuais.push(valor.toLowerCase())
        ultimaFoiAgente = true
        continue
      }
      ultimaFoiAgente = false
      if ((chave === "allow" || chave === "disallow") && valor) {
        const regra: Regra = { permitir: chave === "allow", padrao: paraRegex(valor), tamanho: valor.length }
        for (const agente of agentesAtuais) {
          const lista = grupos.get(agente) ?? []
          lista.push(regra)
          grupos.set(agente, lista)
        }
      }
    }
    const token = tokenAgente.toLowerCase()
    return new Robots(grupos.get(token) ?? grupos.get("*") ?? [])
  }

  static liberarTudo(): Robots {
    return new Robots([])
  }

  permitido(url: string): boolean {
    let caminho: string
    try {
      const u = new URL(url)
      caminho = u.pathname + u.search
    } catch (e) {
      console.error("[robots] URL inválida:", url, e)
      return false
    }
    let melhor: Regra | null = null
    for (const regra of this.regras) {
      if (regra.padrao.test(caminho) && (!melhor || regra.tamanho > melhor.tamanho || (regra.tamanho === melhor.tamanho && regra.permitir))) {
        melhor = regra
      }
    }
    return melhor ? melhor.permitir : true
  }
}

function paraRegex(padrao: string): RegExp {
  const ancorado = padrao.endsWith("$")
  const corpo = (ancorado ? padrao.slice(0, -1) : padrao)
    .split("*")
    .map((parte) => parte.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*")
  return new RegExp("^" + corpo + (ancorado ? "$" : ""))
}
