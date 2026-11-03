/**
 * Classificação de produtos a partir do slug da URL.
 * Padrão esperado (peças de moto): <tipo de peça>-<marca>-<modelo>-<anos>-<condição>-<código>
 * Ex.: pinca-freio-dianteiro-honda-cbr-1000-rr-2008-2011-usado-original-00512345
 */
import { MARCAS_VEICULO } from "./config"

/** Sistemas propostos (decisão final é do negócio). Ordem = prioridade: o primeiro que casar vence. */
export const SISTEMAS: { sistema: string; termos: string[] }[] = [
  { sistema: "Freios", termos: ["freio", "freios", "pinca", "abs", "pastilha", "pastilhas", "burrinho", "disco freio", "parafuso disco", "cilindro mestre", "fluido"] },
  { sistema: "Transmissão e Embreagem", termos: ["embreagem", "campana", "plato", "cambio", "pinhao", "coroa", "relacao", "garfo seletor", "seletor", "corrente transmissao", "kit relacao", "esticador corrente", "guia corrente", "deslizante", "quick shifter", "shifter", "cardan", "diferencial", "correia", "disco separador"] },
  { sistema: "Iluminação", termos: ["farol", "farois", "lanterna", "pisca", "piscas", "luz placa", "lampada", "milha", "refletor", "olho gato", "meia luz"] },
  { sistema: "Painel e Instrumentos", termos: ["painel", "velocimetro", "conta giros", "display", "odometro", "tacometro"] },
  { sistema: "Arrefecimento", termos: ["radiador", "ventoinha", "ventilador", "bomba agua", "termostato", "reservatorio agua", "arrefecimento", "valvula termostatica", "agua"] },
  { sistema: "Escapamento", termos: ["escapamento", "escape", "ponteira", "catalisador", "silencioso", "curva escape", "coletor escape", "abafador", "curva intermediaria"] },
  {
    sistema: "Alimentação e Injeção",
    termos: ["injetor", "injecao", "tbi", "carburador", "combustivel", "tanque", "admissao", "filtro ar", "caixa filtro", "borboleta", "sensor map", "lambda", "gasolina", "boia", "torneira", "flauta", "regulador pressao", "caixa de ar", "caixa ar", "condutor ar", "duto", "manicoto", "manicotos", "canister"],
  },
  {
    sistema: "Elétrica e Eletrônica",
    termos: [
      "chicote", "bobina", "ignicao", "rele", "estator", "retificador", "regulador", "bateria", "partida", "modulo", "cdi", "central", "ecu", "fusivel",
      "buzina", "interruptor", "chave punho", "sensor", "alternador", "magneto", "soquete", "antena", "imobilizador", "usb", "tomada", "conector", "fiacao", "negativo", "positivo", "pulsador", "fusiveis", "diodo",
    ],
  },
  { sistema: "Suspensão e Direção", termos: ["amortecedor", "bengala", "bengalas", "suspensao", "articulacao", "link suspensao", "mesa", "mesas", "coluna direcao", "direcao", "tubo bengala", "retentor bengala", "garfo"] },
  { sistema: "Rodas e Pneus", termos: ["roda", "rodas", "pneu", "pneus", "aro", "cubo", "raio", "camara", "eixo roda", "rolamento roda", "espacador roda"] },
  { sistema: "Comandos e Guidão", termos: ["guidao", "manete", "manetes", "manopla", "manoplas", "punho", "retrovisor", "retrovisores", "espelho", "acelerador", "pedal", "alavanca", "peso guidao"] },
  { sistema: "Banco e Bagageiro", termos: ["banco", "assento", "bagageiro", "bau", "bauleto", "alca", "garupa", "mala", "malas", "bolsa"] },
  {
    sistema: "Carenagem e Acabamentos",
    termos: ["carenagem", "para lama", "paralama", "rabeta", "bolha", "parabrisa", "para brisa", "spoiler", "acabamento", "tampa lateral", "adesivo", "emblema", "capa", "protetor", "carenagens", "defletor", "ponteira tanque", "aba", "bico frontal"],
  },
  { sistema: "Chassi e Quadro", termos: ["quadro", "chassi", "chassis", "subquadro", "balanca", "pedaleira", "pedaleiras", "bacalhau", "cavalete", "descanso", "slider", "estribo", "suporte placa", "suporte", "suportes"] },
  {
    sistema: "Motor",
    termos: [
      "motor", "virabrequim", "biela", "pistao", "cilindro", "cabecote", "comando", "valvula", "valvulas", "carter", "junta", "oleo", "tensor", "bloco", "vela",
      "tucho", "balancim", "engrenagem", "eixo comando", "corrente comando", "bomba oleo", "tampa motor", "tampa valvula", "respiro", "polia", "volante", "estator motor", "balanceiro",
    ],
  },
  { sistema: "Acessórios e Ferramentas", termos: ["ferramenta", "ferramentas", "manual", "chaveiro", "capa moto"] },
  { sistema: "Parafusos e Fixação", termos: ["parafuso", "parafusos", "porca", "porcas", "arruela", "presilha", "abracadeira", "trava", "pino", "prisioneiro", "rebite", "bucha", "coxim", "grampo"] },
]

export const SEM_SISTEMA = "Não classificado"

const PARADAS_MODELO = new Set([
  "usado", "usada", "usad", "usados", "original", "originais", "orig", "c", "com", "detalhe", "detalhes", "avaria", "avarias", "a", "ate", "km", "novo", "nova", "seminovo", "par", "e", "de",
  "do", "da",
])

/** Tokens que não descrevem o tipo de peça (lado/posição ficam; condição sai). */
const RUIDO_TIPO = new Set(["c", "com", "detalhe", "detalhes", "avaria", "avarias", "usado", "usada", "usad", "original", "originais", "kit"])

export interface MarcaSlug {
  canonica: string
  tokens: string[]
}

/** Marcas em forma de tokens de slug, multi-palavra primeiro (harley-davidson antes de harley). */
export const MARCAS_SLUG: MarcaSlug[] = MARCAS_VEICULO.map((m) => ({
  canonica: m === "harley" ? "harley davidson" : m,
  tokens: m.split(" "),
})).sort((a, b) => b.tokens.length - a.tokens.length)

export function tokenizar(slug: string): string[] {
  let s = slug
  try {
    s = decodeURIComponent(slug)
  } catch (e) {
    console.error("[taxonomy] slug com escape inválido:", slug, e)
  }
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      // "13-16c-avaria": ano colado com o "c" de "c/ avaria" -> ["16", "c"]
      .flatMap((t) => (/^\d{2}c$/.test(t) ? [t.slice(0, 2), "c"] : [t]))
  )
}

/** Chave independente da ordem das palavras: "r1 yzf" e "yzf r1" viram a mesma. */
export const chaveModelo = (modelo: string): string => modelo.split(" ").sort().join(" ")

export function detectarMarca(tokens: string[]): { marca: string; inicio: number; fim: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    for (const m of MARCAS_SLUG) {
      if (m.tokens.every((t, k) => tokens[i + k] === t)) return { marca: m.canonica, inicio: i, fim: i + m.tokens.length }
    }
  }
  return null
}

const ehAno4 = (t: string) => /^(19[7-9]\d|20[0-3]\d)$/.test(t)
const ehDoisDigitos = (t: string) => /^\d{2}$/.test(t)
const ehCodigo = (t: string) => /^\d{6,}$/.test(t)

function anoCompleto(t: string): number {
  const n = Number(t)
  return t.length === 4 ? n : n >= 70 ? 1900 + n : 2000 + n
}

export interface ModeloAnos {
  modelo: string[]
  anos: string | null
  codigo: string | null
}

/**
 * Lê os tokens depois da marca: modelo até encontrar ano, condição ou código.
 * "cbr-1000-rr-08-11-usado" -> modelo [cbr,1000,rr], anos 2008-2011.
 */
export function extrairModeloEAnos(tokens: string[]): ModeloAnos {
  const modelo: string[] = []
  const anos: number[] = []
  let codigo: string | null = null
  let fimModelo = false
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const prox = tokens[i + 1]
    if (ehCodigo(t)) {
      codigo = t
      fimModelo = true
      continue
    }
    // Slug truncado ("13-1"): dígito solto no fim depois de um ano de 2 dígitos.
    const truncado = prox !== undefined && /^\d$/.test(prox) && i + 2 === tokens.length
    const anoDuplo =
      ehDoisDigitos(t) &&
      (prox === undefined || ehDoisDigitos(prox) || ehAno4(prox) || prox === "a" || PARADAS_MODELO.has(prox) || ehCodigo(prox) || truncado || t.startsWith("0"))
    // "mt-07", "mt-09": número logo após uma sigla curta é parte do modelo, não ano.
    const siglaCurta = !fimModelo && modelo.length === 1 && /^[a-z]{1,3}$/.test(modelo[0])
    if (ehAno4(t) || (anoDuplo && !siglaCurta && (modelo.length > 0 || fimModelo))) {
      anos.push(anoCompleto(t))
      fimModelo = true
      continue
    }
    if (PARADAS_MODELO.has(t)) {
      if (modelo.length) fimModelo = true
      continue
    }
    if (!fimModelo && modelo.length < 5) modelo.push(t)
  }
  return { modelo: limparModelo(modelo), anos: formatarAnos(anos), codigo }
}

/** Remove repetição ("gsxr 750 srad srad 750") e apelido colado ("cb 650 f cb650f"). */
export function limparModelo(tokens: string[]): string[] {
  const saida: string[] = []
  for (const t of tokens) {
    if (saida.includes(t)) continue
    let colado = false
    for (let i = 0; i < saida.length && !colado; i++) {
      if (saida.slice(i).join("") === t) colado = true
    }
    if (!colado) saida.push(t)
  }
  // Ordem inversa: "1200s 1200 s" -> a sequência "1200 s" repete o token "1200s" já visto.
  for (let i = 1; i < saida.length; i++) {
    for (let j = saida.length; j > i + 1; j--) {
      if (saida.slice(0, i).includes(saida.slice(i, j).join(""))) {
        saida.splice(i, j - i)
        break
      }
    }
  }
  return saida
}

function formatarAnos(anos: number[]): string | null {
  if (!anos.length) return null
  const min = Math.min(...anos)
  const max = Math.max(...anos)
  return min === max ? String(min) : `${min}-${max}`
}

export function limparTipo(tokens: string[]): string {
  return tokens.filter((t) => !RUIDO_TIPO.has(t) && !/^\d+$/.test(t)).join(" ")
}

export function classificarSistema(tipo: string): string {
  const alvo = ` ${tipo} `
  for (const { sistema, termos } of SISTEMAS) {
    if (termos.some((t) => alvo.includes(` ${t} `))) return sistema
  }
  return SEM_SISTEMA
}

export interface Classificacao {
  url: string
  tipoPeca: string
  sistema: string
  marca: string | null
  /** "slug": marca no slug; "modelo": inferida pelo modelo conhecido; "familia": pela família do modelo (ex.: multistrada -> ducati). */
  fonteMarca: "slug" | "modelo" | "familia" | null
  modelo: string | null
  anos: string | null
  codigo: string | null
  comDetalhe: boolean
}

const temDetalhe = (tokens: string[]) => tokens.some((t) => t === "detalhe" || t === "detalhes" || t === "avaria" || t === "avarias")

export interface ModeloConhecido {
  marca: string
  /** Variante mais frequente do nome (para exibir). */
  nome: string
}

/** Dicionário modelo -> marca aprendido dos slugs que trazem as duas coisas. Chave independe da ordem das palavras. */
export class DicionarioModelos {
  private readonly porChave = new Map<string, { marcas: Map<string, number>; variantes: Map<string, number> }>()
  private readonly porFamilia = new Map<string, Map<string, number>>()

  registrar(modelo: string, marca: string): void {
    const chave = chaveModelo(modelo)
    const atual = this.porChave.get(chave) ?? { marcas: new Map<string, number>(), variantes: new Map<string, number>() }
    atual.marcas.set(marca, (atual.marcas.get(marca) ?? 0) + 1)
    atual.variantes.set(modelo, (atual.variantes.get(modelo) ?? 0) + 1)
    this.porChave.set(chave, atual)
    const familia = modelo.split(" ")[0]
    const f = this.porFamilia.get(familia) ?? new Map<string, number>()
    f.set(marca, (f.get(marca) ?? 0) + 1)
    this.porFamilia.set(familia, f)
  }

  /** Famílias (1ª palavra do modelo) longas, frequentes e de uma marca só (≥ 95%). */
  familias(minimo: number): Map<string, string> {
    const final = new Map<string, string>()
    for (const [familia, marcas] of this.porFamilia) {
      const total = Array.from(marcas.values()).reduce((a, b) => a + b, 0)
      const [marca, n] = Array.from(marcas.entries()).sort((a, b) => b[1] - a[1])[0]
      if (/^[a-z]{5,}$/.test(familia) && total >= minimo && n / total >= 0.95) final.set(familia, marca)
    }
    return final
  }

  /** Mantém só modelos frequentes, específicos e sem ambiguidade de marca (≥ 90% numa marca). */
  consolidar(minimo: number): Map<string, ModeloConhecido> {
    const final = new Map<string, ModeloConhecido>()
    for (const [chave, { marcas, variantes }] of this.porChave) {
      const total = Array.from(marcas.values()).reduce((a, b) => a + b, 0)
      const [marca, n] = Array.from(marcas.entries()).sort((a, b) => b[1] - a[1])[0]
      const [nome] = Array.from(variantes.entries()).sort((a, b) => b[1] - a[1])[0]
      const especifico = chave.length >= 3 && (/\d/.test(chave) || chave.length >= 5)
      if (total >= minimo && n / total >= 0.9 && especifico) final.set(chave, { marca, nome })
    }
    return final
  }
}

export function classificarComMarca(url: string, tokens: string[], achado: { marca: string; inicio: number; fim: number }): Classificacao {
  const { modelo, anos, codigo } = extrairModeloEAnos(tokens.slice(achado.fim))
  const tipo = limparTipo(tokens.slice(0, achado.inicio))
  return {
    url,
    tipoPeca: tipo,
    sistema: classificarSistema(tipo),
    marca: achado.marca,
    fonteMarca: "slug",
    modelo: modelo.length ? modelo.join(" ") : null,
    anos,
    codigo,
    comDetalhe: temDetalhe(tokens),
  }
}

/** Slug sem marca: procura o modelo conhecido mais longo (em qualquer ordem de palavras) e usa a marca dele. */
export function classificarSemMarca(url: string, tokens: string[], dicionario: Map<string, ModeloConhecido>, familias: Map<string, string> = new Map()): Classificacao {
  let melhor: { inicio: number; n: number; modelo: ModeloConhecido } | null = null
  for (let i = 0; i < tokens.length; i++) {
    for (let n = Math.min(5, tokens.length - i); n >= 1; n--) {
      const conhecido = dicionario.get(chaveModelo(limparModelo(tokens.slice(i, i + n)).join(" ")))
      if (conhecido && (!melhor || n > melhor.n)) melhor = { inicio: i, n, modelo: conhecido }
    }
  }
  if (!melhor) {
    const iFamilia = tokens.findIndex((t) => familias.has(t))
    if (iFamilia >= 0) {
      const { modelo, anos, codigo } = extrairModeloEAnos(tokens.slice(iFamilia))
      const tipo = limparTipo(tokens.slice(0, iFamilia))
      return {
        url,
        tipoPeca: tipo,
        sistema: classificarSistema(tipo),
        marca: familias.get(tokens[iFamilia]) ?? null,
        fonteMarca: "familia",
        modelo: modelo.join(" ") || null,
        anos,
        codigo,
        comDetalhe: temDetalhe(tokens),
      }
    }
    const { anos, codigo } = extrairModeloEAnos(tokens.filter((t) => ehAno4(t) || ehCodigo(t)))
    const tipo = limparTipo(tokens.filter((t) => !ehAno4(t) && !ehCodigo(t) && !PARADAS_MODELO.has(t)))
    return { url, tipoPeca: tipo, sistema: classificarSistema(tipo), marca: null, fonteMarca: null, modelo: null, anos, codigo, comDetalhe: temDetalhe(tokens) }
  }
  const tipo = limparTipo(tokens.slice(0, melhor.inicio))
  // Prefixo "modelo" faz o parser tratar o resto como pós-modelo (anos de 2 dígitos são reconhecidos).
  const { anos, codigo } = extrairModeloEAnos(["modelo", ...tokens.slice(melhor.inicio + melhor.n)])
  return {
    url,
    tipoPeca: tipo,
    sistema: classificarSistema(tipo),
    marca: melhor.modelo.marca,
    fonteMarca: "modelo",
    modelo: melhor.modelo.nome,
    anos,
    codigo,
    comDetalhe: temDetalhe(tokens),
  }
}
