/**
 * Cliente mínimo da API Magazord v2 (somente GET).
 *
 * Autenticação: Basic (token como usuário, senha como senha).
 * - Na nuvem do Claude Code, o segredo de rede injeta o cabeçalho; o script não envia nada.
 * - Localmente, defina MAGAZORD_TOKEN e MAGAZORD_SENHA no ambiente.
 *
 * Limite informado pela Magazord: 120 requisições / 60 s, possivelmente compartilhado com
 * outras integrações da loja. Padrão aqui: 60/min (1 requisição por segundo, sem paralelismo).
 */
import { Limitador } from "./http"

export interface PaginaMagazord<T> {
  items: T[]
  page: number
  limit: number
  total: number
  total_pages: number
  has_more: boolean
}

export interface CategoriaMagazord {
  id: number
  nome: string
  pai: number | null
}

export interface ProdutoMagazord {
  id: number
  codigo: string
  nome: string
  ativo: boolean
  marca: number | null
  modelo: string | null
  tipo: string | null
  /** O primeiro item é sempre a categoria principal (documentação Magazord). */
  categorias: number[]
  dataLancamento: string | null
  dataAtualizacao: string | null
  derivacoes: { id: number; codigo: string }[]
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const ehObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

export class ClienteMagazord {
  public requisicoes = 0
  private readonly limitador: Limitador
  private readonly cabecalhos: Record<string, string>

  constructor(
    private readonly baseUrl: string,
    intervaloMs = 1000,
  ) {
    this.limitador = new Limitador(intervaloMs)
    this.cabecalhos = { Accept: "application/json" }
    const token = process.env.MAGAZORD_TOKEN
    const senha = process.env.MAGAZORD_SENHA
    if (token && senha) this.cabecalhos.Authorization = `Basic ${Buffer.from(`${token}:${senha}`).toString("base64")}`
  }

  async pagina<T>(rota: string, params: Record<string, string | number>): Promise<PaginaMagazord<T>> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]))
    const url = `${this.baseUrl.replace(/\/+$/, "")}/v2/site/${rota}?${qs}`
    let ultimoErro = ""
    for (let tentativa = 1; tentativa <= 6; tentativa++) {
      await this.limitador.aguardar()
      this.requisicoes++
      try {
        const res = await fetch(url, { headers: this.cabecalhos, signal: AbortSignal.timeout(60_000) })
        if (res.status === 401) throw new Error("401 Não autorizado: credencial ausente ou inválida")
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("retry-after"))
          const espera = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 5000 * 2 ** (tentativa - 1))
          ultimoErro = `HTTP ${res.status}`
          console.error(`[magazord] ${rota} p.${params.page} -> ${res.status}; aguardando ${espera}ms (${tentativa}/6)`)
          await dormir(espera)
          continue
        }
        const corpo: unknown = await res.json()
        if (!ehObj(corpo) || corpo.status !== "success" || !ehObj(corpo.data) || !Array.isArray(corpo.data.items)) {
          throw new Error(`Resposta inesperada (${res.status}): ${JSON.stringify(corpo).slice(0, 300)}`)
        }
        return corpo.data as unknown as PaginaMagazord<T>
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : String(e)
        if (ultimoErro.startsWith("401")) throw e
        console.error(`[magazord] ${rota} p.${params.page} falhou (${tentativa}/6):`, ultimoErro)
        await dormir(Math.min(60_000, 5000 * 2 ** (tentativa - 1)))
      }
    }
    throw new Error(`Desisti de ${rota} p.${params.page}: ${ultimoErro}`)
  }
}

/** Mantém só os campos usados na auditoria (o item bruto tem fiscal, dimensões etc.). */
export function enxugarProduto(item: Record<string, unknown>): ProdutoMagazord {
  const num = (v: unknown) => (typeof v === "number" ? v : null)
  const str = (v: unknown) => (typeof v === "string" ? v : null)
  return {
    id: Number(item.id),
    codigo: str(item.codigo) ?? "",
    nome: str(item.nome) ?? "",
    ativo: item.ativo === true,
    marca: num(item.marca),
    modelo: str(item.modelo),
    tipo: str(item.tipo),
    categorias: Array.isArray(item.categorias) ? item.categorias.filter((c): c is number => typeof c === "number") : [],
    dataLancamento: str(item.dataLancamento),
    dataAtualizacao: str(item.dataAtualizacao),
    derivacoes: Array.isArray(item.derivacoes)
      ? item.derivacoes.filter(ehObj).map((d) => ({ id: Number(d.id), codigo: str(d.codigo) ?? "" }))
      : [],
  }
}
