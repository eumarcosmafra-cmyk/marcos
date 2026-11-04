/**
 * Listas heurísticas. Ajuste por cliente: a classificação final de cada
 * categoria (navegacional / promocional / técnica) é decisão de negócio.
 * Todos os termos são comparados após normalização (minúsculas, sem acento).
 */

/** Categorias criadas para integração/marketplace/feed: nunca devem aparecer no breadcrumb. */
export const TERMOS_CATEGORIA_TECNICA = [
  "mercado livre",
  "mercadolivre",
  "shopee",
  "amazon",
  "magalu",
  "magazine luiza",
  "americanas",
  "b2w",
  "aliexpress",
  "shein",
  "olx",
  "netshoes",
  "marketplace",
  "integracao",
  "feed",
  "importados ml",
  "teste",
  "sem categoria",
]

/** Categorias de campanha/merchandising: podem existir, mas não como categoria principal. */
export const TERMOS_CATEGORIA_PROMOCIONAL = [
  "black friday",
  "black november",
  "cyber monday",
  "% off",
  "oferta",
  "ofertas",
  "promocao",
  "promocoes",
  "outlet",
  "liquida",
  "queima",
  "lancamentos",
]

/** Nomes que não descrevem nada para busca nem para IA. */
export const TERMOS_NOME_GENERICO = ["ver todos", "todos", "produtos", "outros", "diversos", "geral", "variados"]

/** Marcas de veículo (nicho moto). Usado para detectar divergência título × breadcrumb. */
export const MARCAS_VEICULO = [
  "honda",
  "yamaha",
  "suzuki",
  "kawasaki",
  "bmw",
  "ducati",
  "triumph",
  "harley davidson",
  "harley",
  "ktm",
  "royal enfield",
  "dafra",
  "shineray",
  "haojue",
  "kasinski",
  "mv agusta",
  "aprilia",
  "benelli",
  "husqvarna",
  "indian",
  "kymco",
  "piaggio",
  "vespa",
  "cfmoto",
  "voge",
  "bajaj",
  "sundown",
  "traxx",
  // Demais montadoras com produto na loja (cadastro de marcas da Magazord). "vento" ficou de fora:
  // é palavra comum em nome de peça e quebraria a separação tipo/modelo.
  "zontes",
  "agrale",
  "dayun",
  "dayang",
  "fym",
  "buell",
  "bashan",
  "voltz",
  "daelim",
  "leopard",
  "mvk",
  "hyosung",
  "ashima",
  "amazonas",
  "loncin",
  "motorino",
  "lambreta",
  "sanyang",
  "pgo",
  "monark",
  "jawa",
  "cagiva",
]

export const NOMES_HOME = ["home", "inicio", "pagina inicial", "pagina principal"]
