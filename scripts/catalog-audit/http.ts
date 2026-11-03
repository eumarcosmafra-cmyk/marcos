import { gunzipSync } from "node:zlib"

export interface HttpConfig {
  userAgent: string
  timeoutMs: number
  /** Intervalo mínimo entre requisições (global, todas as conexões). */
  delayMs: number
  maxTentativas: number
}

export interface Resposta {
  status: number
  urlFinal: string
  corpo: string
  contentType: string | null
  erro: string | null
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Garante intervalo mínimo entre requisições, mesmo com concorrência > 1. */
export class Limitador {
  private proximo = 0
  constructor(private readonly intervaloMs: number) {}

  async aguardar(): Promise<void> {
    const agora = Date.now()
    const slot = Math.max(agora, this.proximo)
    this.proximo = slot + this.intervaloMs
    if (slot > agora) await dormir(slot - agora)
  }
}

export class ClienteHttp {
  public requisicoes = 0
  private readonly limitador: Limitador

  constructor(private readonly cfg: HttpConfig) {
    this.limitador = new Limitador(cfg.delayMs)
  }

  async baixar(url: string): Promise<Resposta> {
    let ultimoErro = "erro desconhecido"
    for (let tentativa = 1; tentativa <= this.cfg.maxTentativas; tentativa++) {
      await this.limitador.aguardar()
      this.requisicoes++
      const controle = new AbortController()
      const timer = setTimeout(() => controle.abort(), this.cfg.timeoutMs)
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": this.cfg.userAgent, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
          redirect: "follow",
          signal: controle.signal,
        })
        if (res.status === 429 || res.status >= 500) {
          ultimoErro = `HTTP ${res.status}`
          const retryAfter = Number(res.headers.get("retry-after"))
          const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : backoff(tentativa)
          console.error(`[http] ${url} -> ${res.status}; nova tentativa em ${espera}ms (${tentativa}/${this.cfg.maxTentativas})`)
          await dormir(espera)
          continue
        }
        const bytes = Buffer.from(await res.arrayBuffer())
        const ehGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
        const corpo = (ehGzip ? gunzipSync(bytes) : bytes).toString("utf-8")
        return { status: res.status, urlFinal: res.url || url, corpo, contentType: res.headers.get("content-type"), erro: null }
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : String(e)
        console.error(`[http] ${url} falhou (${tentativa}/${this.cfg.maxTentativas}):`, ultimoErro)
        await dormir(backoff(tentativa))
      } finally {
        clearTimeout(timer)
      }
    }
    return { status: 0, urlFinal: url, corpo: "", contentType: null, erro: ultimoErro }
  }
}

function backoff(tentativa: number): number {
  return 1000 * 2 ** (tentativa - 1) + Math.floor(Math.random() * 500)
}

/** Executa tarefas com concorrência limitada, preservando a ordem do resultado. */
export async function emLotes<T, R>(itens: T[], concorrencia: number, tarefa: (item: T, indice: number) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length)
  let cursor = 0
  const trabalhadores = Array.from({ length: Math.max(1, concorrencia) }, async () => {
    while (cursor < itens.length) {
      const i = cursor++
      resultados[i] = await tarefa(itens[i], i)
    }
  })
  await Promise.all(trabalhadores)
  return resultados
}
