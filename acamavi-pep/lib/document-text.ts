// Texto do modelo "Declaração sobre condição de Pessoa Politicamente Exposta — Pessoa Física",
// mantido literalmente. Única alteração: removido o item "Este formulário deve ser apresentado
// na forma impressa e assinado." (itens seguintes renumerados).

export const ASSOCIACAO_SIGLA = "ACAMAVI"
export const ASSOCIACAO_NOME = "Associação Cultural e de Artes Marciais do Alto Vale do Itajaí"

export const TITULO = "DECLARAÇÃO SOBRE CONDIÇÃO DE PESSOA POLITICAMENTE EXPOSTA"
export const SUBTITULO = "PESSOA FÍSICA"

export const ORIENTACOES_TITULO = "Orientações Gerais:"
export const ORIENTACOES = {
  quem: "Quem deve preencher esse formulário:",
  subitens: [
    ["1.1.", "Sócio que detenha 10% ou mais do capital social da empresa;"],
    ["1.2.", "Sócio que seja administrador da empresa, mesmo que possua capital social inferior a 10%;"],
    ["1.3.", "Administradores da empresa."],
  ] as const,
  confidencial: "As informações são de uso estritamente confidencial.",
}

export const DECLARO =
  "Declaro, de acordo com a Lei 9.613/98 e a regulamentação complementar do Banco Central do Brasil, minha condição em relação ao enquadramento como pessoa politicamente exposta:"
export const OPCAO_SIM = "SIM, enquadro-me como pessoa politicamente exposta."
export const OPCAO_NAO = "NÃO me enquadro como pessoa politicamente exposta."
export const CASO_SIM = "Caso a opção seja SIM, preencher o quadro abaixo:"
export const TABELA_COLUNAS = {
  nome: "Nome",
  situacao: "Situação*",
  cargo: ["Cargo / Emprego /", "Função Público (a)"],
  periodo: "Período",
  de: "De",
  ate: "Até",
}
export const TABELA_NOTA = "* Exemplos: proponente, esposa do proponente, procurador do proponente."

export const CARACTERIZACAO_TITULO = "Caracterização de pessoa politicamente exposta:"
export const CARACTERIZACAO_1 =
  "Considera-se pessoa politicamente exposta o declarante que desempenha ou tenha desempenhado, ou, ainda, cujos representantes, familiares e outras pessoas de seu relacionamento próximo desempenhem ou tenham desempenhado, nos últimos 5 (cinco) anos, cargos, empregos ou funções públicas relevantes."
export const CARACTERIZACAO_2 =
  "Relação de cargos, empregos e funções públicas relevantes cujos ocupantes são considerados pessoas politicamente expostas:"
export const PARA_BRASILEIROS = "Para Brasileiros:"

export interface ItemLista {
  rotulo: string
  texto: string
  subitens?: { rotulo: string; texto: string }[]
}

export const LISTA_BRASILEIROS: ItemLista[] = [
  { rotulo: "I -", texto: "Detentores de mandatos eletivos dos Poderes Executivo e Legislativo da União;" },
  {
    rotulo: "II -",
    texto: "Ocupantes de cargo, no Poder Executivo da União:",
    subitens: [
      { rotulo: "a)", texto: "de ministro de estado ou equiparado;" },
      { rotulo: "b)", texto: "de natureza especial ou equivalente;" },
      {
        rotulo: "c)",
        texto:
          "de presidente, vice-presidente e diretor, ou equivalentes, de autarquias, fundações públicas, empresas públicas ou sociedades de economia mista;",
      },
      { rotulo: "d)", texto: "do Grupo Direção e Assessoramento Superiores (DAS), nível 6, ou equivalentes;" },
    ],
  },
  {
    rotulo: "III -",
    texto: "Membros do Conselho Nacional de Justiça, do Supremo Tribunal Federal e dos tribunais superiores;",
  },
  {
    rotulo: "IV -",
    texto:
      "Membros do Conselho Nacional do Ministério Público, Procurador-Geral da República, Vice-Procurador-Geral da República, Procurador-Geral do Trabalho, Procurador-Geral da Justiça Militar, Subprocuradores-Gerais da República e Procuradores-Gerais de Justiça dos Estados e do Distrito Federal;",
  },
  {
    rotulo: "V -",
    texto:
      "Membros do Tribunal de Contas da União e Procurador-Geral do Ministério Público junto ao Tribunal de Contas da União;",
  },
  {
    rotulo: "VI -",
    texto:
      "Governadores de estado e do Distrito Federal, os presidentes de Tribunal de Justiça, de Assembleia e Câmara Legislativa, os presidentes de tribunal e de conselho de contas de Estado, de Municípios e do Distrito Federal;",
  },
  { rotulo: "VII -", texto: "Prefeitos e presidentes de Câmara Municipal de capitais de Estados." },
]

export const PARA_ESTRANGEIROS = "Para Estrangeiros:"
export const TEXTO_ESTRANGEIROS =
  "Chefes de estado e de governo, políticos de alto nível, altos servidores dos poderes públicos, magistrados ou militares de alto nível, dirigentes de empresas públicas ou dirigentes de partidos políticos."
export const CARACTERIZACAO_3 =
  "São considerados familiares do declarante os parentes, na linha reta, até o primeiro grau, o cônjuge, o companheiro, a companheira, o enteado e a enteada."
export const CARACTERIZACAO_4 =
  "São considerados exemplos de relacionamentos próximos situações tais como: constituição de pessoa politicamente exposta como procurador ou preposto; movimentação habitual de recursos financeiros de ou para pessoa politicamente exposta, não justificada por eventos econômicos, como a aquisição de bens ou prestação de serviços."
