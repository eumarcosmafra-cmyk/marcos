export type Severidade = "CRITICA" | "ALTA" | "MEDIA" | "INFO"

export const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  CRITICA: 3,
  ALTA: 2,
  MEDIA: 1,
  INFO: 0,
}

export interface Achado {
  regra: string
  severidade: Severidade
  detalhe: string
}

export interface BreadcrumbItem {
  nome: string
  url: string | null
  /** ID da categoria quando a plataforma expõe (Magazord embute no HTML). */
  id?: number | null
  idPai?: number | null
}

export interface DadosBase {
  url: string
  status: number
  urlFinal: string
  erro: string | null
  titulo: string | null
  h1: string | null
  canonical: string | null
  robots: string | null
  breadcrumbJsonLd: BreadcrumbItem[] | null
  jsonLdInvalido: number
}

export interface DadosProduto extends DadosBase {
  /** Breadcrumb que a plataforma embute no HTML (Magazord: `breadcrumb: [...]`). */
  breadcrumbPlataforma: BreadcrumbItem[] | null
  categoriaPrincipalId: number | null
  /** Valor do input oculto `#prod-categorias` (Magazord). */
  categoriasPagina: string | null
  nomeProduto: string | null
  marcaSchema: string | null
  condicaoSchema: string | null
  categoriaSchema: string | null
  compatMarca: string | null
  compatModelo: string | null
  compatAnos: string | null
  /** Nome, título, URL ou descrição dizem que o item é usado. */
  mencionaUsado: boolean
  /** Categoria de listagem de onde o produto foi coletado (modo --categoria). */
  categoriaOrigem: string | null
}

export interface DadosCategoria extends DadosBase {
  produtosNaListagem: number
  proximaPagina: string | null
}

export interface Sugestao {
  caminhoSugerido: string | null
  categoriasExistentes: string[]
  candidatas: string[]
}

export interface ResultadoProduto {
  dados: DadosProduto
  achados: Achado[]
  sugestao: Sugestao
}

export interface ResultadoCategoria {
  dados: DadosCategoria
  achados: Achado[]
}
