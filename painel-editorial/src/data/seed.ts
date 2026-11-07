/**
 * Dados de demonstração.
 *
 * Tudo aqui é fictício e marcado com `isDemo: true`, EXCETO os trechos de
 * "Informações do cliente" importados de arquivo real do projeto
 * (origem rastreável em `AVTT_PROFILE_REF`). Mesmo esses trechos são apenas
 * fontes cadastradas na biblioteca: nenhum recibo prova que um agente os usou.
 */
import type {
  Article,
  ArticleDecision,
  ArticleVersion,
  Comment,
  Decision,
  IntegrationState,
  InventoryItem,
  LibrarySource,
  Origin,
  Pauta,
  PautaDecision,
  Project,
  ProjectWorkspace,
  QualityFlag,
  RetrievedChunk,
  ReviewerIdentity,
  WorkflowRun,
} from "@/domain/types";
import { snapshotBriefing } from "@/domain/commands";

export const DEMO: Origin = { kind: "demonstracao", label: "Dado de demonstração (fictício)" };

export const AVTT_PROFILE_REF =
  "github.com/eumarcosmafra-cmyk/avtt-atendimento-ia @ c59fa22 · knowledge/academy/profile.md";

export const DEMO_REVIEWERS: ReviewerIdentity[] = [
  { id: "rev-marcos", name: "Marcos", role: "editor", isLocal: true },
  { id: "rev-editora", name: "Revisora editorial (demo)", role: "editor", isLocal: true },
  { id: "rev-professor", name: "Professor responsável (demo)", role: "especialista", isLocal: true },
  { id: "rev-gestor", name: "Gestão MAFRA LABS (demo)", role: "gestor", isLocal: true },
];

function integrations(): IntegrationState[] {
  return [
    { key: "n8n", label: "n8n (workflows dos agentes)", status: "nao_conectado", note: "Saídas de Analista, Planejador, Pesquisador, Redator e Revisor ainda não são recebidas." },
    { key: "supabase", label: "Supabase (persistência compartilhada e RAG)", status: "nao_conectado", note: "Os dados desta demonstração ficam apenas neste navegador." },
    { key: "site", label: "Site / Astro (publicação)", status: "nao_conectado", note: "Nenhum conteúdo é publicado a partir do painel." },
  ];
}

const T = {
  d20: "2026-10-20T13:10:00.000Z",
  d22: "2026-10-22T14:25:00.000Z",
  d24: "2026-10-24T12:00:00.000Z",
  d26: "2026-10-26T16:40:00.000Z",
  d27: "2026-10-27T11:15:00.000Z",
  d28: "2026-10-28T18:05:00.000Z",
  d29: "2026-10-29T13:30:00.000Z",
  d30: "2026-10-30T15:50:00.000Z",
};

/* ------------------------------------------------------------------ */
/* AVTT                                                                */
/* ------------------------------------------------------------------ */

const AVTT_ID = "avtt";

const avttProject: Project = {
  id: AVTT_ID,
  name: "Alto Vale Top Team",
  shortName: "AVTT",
  siteUrl: "https://altovaletopteam.com.br/",
  siteStack: "Astro",
  location: "Rio do Sul/SC",
  audience:
    "Pessoas que buscam informação sobre Muay Thai e Boxe — de quem nunca treinou a praticantes. Conteúdo local apenas quando a intenção de busca for local.",
  editorialDirection:
    "Blog informacional de alcance nacional quando a pesquisa indicar essa intenção. Ser uma academia local não transforma toda pauta em venda local ou escolha de turma. Não citar nomes de professores, lutadores, alunos ou funcionários.",
  technicalOwner: "A definir (preencher)",
  requiresSpecialistReview: true,
  integrations: integrations(),
  isDemo: true,
  origin: {
    kind: "importado",
    label: "Site, localização e regra sobre nomes conferidos no perfil da academia; demais campos são demonstrativos",
    ref: AVTT_PROFILE_REF,
  },
  createdAt: T.d20,
  updatedAt: T.d20,
};

const pMuayFeminino: Pauta = {
  id: "pauta-muay-feminino",
  projectId: AVTT_ID,
  revision: 2,
  title: "Muay Thai feminino: como começar com segurança",
  primaryKeyword: "muay thai feminino",
  secondaryKeywords: ["muay thai para mulheres", "aula de muay thai feminina", "muay thai iniciante"],
  intent: "informacional",
  audience: "Mulheres que nunca treinaram e querem entender como é começar no Muay Thai.",
  question: "Muay Thai é indicado para mulheres iniciantes e como é a primeira fase de treino?",
  cluster: "Muay Thai — iniciação",
  rationale:
    "[Demonstração] Sugestão do Planejador com base em dúvidas recorrentes de iniciantes. Volume de busca: a confirmar com fonte.",
  coverageContribution:
    "Abre o subtema 'públicos específicos' dentro do cluster de iniciação, hoje sem conteúdo dedicado no inventário demonstrativo.",
  briefingMarkdown: `## Objetivo
Responder, sem promessas exageradas, como é começar no Muay Thai sendo mulher e iniciante.

## Pontos obrigatórios
- Medos comuns da primeira aula e como a adaptação costuma acontecer
- Equipamentos básicos para começar
- Segurança: aquecimento, controle de intensidade e respeito ao próprio ritmo

## Evitar
- Linguagem de venda local ou convite para turma específica
- Afirmações de saúde sem fonte de domínio`,
  outlineMarkdown: `## Muay Thai é para mulheres iniciantes?
## Como costuma ser a primeira fase de treino
## Equipamentos básicos
## Cuidados de segurança
## Perguntas frequentes`,
  plannedLinks: [
    { id: "pl-1", anchor: "fundamentos do boxe", url: "/blog/fundamentos-do-boxe-para-iniciantes", note: "Artigo em produção (demonstração)" },
  ],
  researchEvidence: [
    {
      id: "ev-1",
      source: "Pesquisa de palavras-chave — exemplo",
      locality: "Brasil",
      collectedAt: "2026-10-18",
      summary: "[Demonstração] Exemplo de evidência. Nenhuma ferramenta de pesquisa está conectada; volumes não são exibidos.",
      isDemo: true,
    },
  ],
  relatedContent: [],
  owner: "Marcos",
  plannedDate: "2026-11-18",
  priority: "alta",
  status: "em_revisao",
  isDemo: true,
  origin: { kind: "demonstracao", label: "Sugestão demonstrativa do agente Planejador" },
  createdAt: T.d22,
  updatedAt: T.d27,
};

const pFundamentosBoxe: Pauta = {
  id: "pauta-fundamentos-boxe",
  projectId: AVTT_ID,
  revision: 1,
  title: "Fundamentos do boxe para iniciantes",
  primaryKeyword: "fundamentos do boxe",
  secondaryKeywords: ["boxe para iniciantes", "golpes básicos do boxe", "guarda do boxe"],
  intent: "informacional",
  audience: "Iniciantes de qualquer região que querem entender a base técnica do boxe antes de treinar.",
  question: "Quais são os fundamentos do boxe e por onde um iniciante deve começar?",
  cluster: "Boxe — fundamentos",
  rationale: "[Demonstração] Pauta-pilar do cluster de boxe. Dados de demanda: a confirmar com fonte.",
  coverageContribution: "Pilar do cluster; servirá de destino para links internos dos artigos de técnica.",
  briefingMarkdown: `## Objetivo
Explicar os fundamentos (guarda, base, deslocamento, golpes e defesa) em linguagem simples.

## Pontos obrigatórios
- Guarda e postura
- Base e deslocamento
- Os quatro golpes básicos
- Defesa e respiração
- Erros comuns de iniciantes

## Tom
Didático, sem jargão sem explicação. Alcance nacional.`,
  outlineMarkdown: `## O que são os fundamentos do boxe
## Guarda e postura
## Base e deslocamento
## Os golpes básicos
## Defesa e respiração
## Erros comuns de iniciantes
## Perguntas frequentes`,
  plannedLinks: [
    { id: "pl-2", anchor: "diferenças entre boxe e Muay Thai", url: "/blog/diferencas-entre-boxe-e-muay-thai", note: "Pauta sugerida (demonstração)" },
    { id: "pl-3", anchor: "como escolher luvas de boxe", url: "/blog/como-escolher-luvas-de-boxe", note: "Artigo em produção (demonstração)" },
  ],
  researchEvidence: [
    {
      id: "ev-2",
      source: "SERP — exemplo",
      locality: "Brasil",
      collectedAt: "2026-10-15",
      summary: "[Demonstração] Exemplo de anotação de SERP. Nenhuma coleta real foi feita.",
      isDemo: true,
    },
  ],
  relatedContent: [
    {
      id: "rc-1",
      title: "(Exemplo) Boxe: benefícios para iniciantes",
      url: "https://altovaletopteam.com.br/exemplo/boxe-beneficios",
      note: "Sobreposição SIMULADA para demonstração: ambos tratam de iniciantes no boxe. Nenhuma auditoria real foi feita.",
      overlap: "simulada",
      isDemo: true,
    },
  ],
  owner: "Marcos",
  plannedDate: "2026-11-11",
  priority: "alta",
  status: "aprovada",
  articleId: "art-fundamentos-boxe",
  isDemo: true,
  origin: { kind: "demonstracao", label: "Sugestão demonstrativa do agente Planejador" },
  createdAt: T.d20,
  updatedAt: T.d24,
};

const pDiferencas: Pauta = {
  id: "pauta-diferencas",
  projectId: AVTT_ID,
  revision: 1,
  title: "Diferenças entre boxe e Muay Thai",
  primaryKeyword: "diferença entre boxe e muay thai",
  secondaryKeywords: ["boxe ou muay thai", "muay thai x boxe"],
  intent: "informacional",
  audience: "Quem está em dúvida entre as duas modalidades e quer comparar técnica, regras e treino.",
  question: "O que muda entre boxe e Muay Thai e qual combina com o meu objetivo?",
  cluster: "Comparativos de modalidades",
  rationale: "[Demonstração] Comparativo com intenção informacional; pode alimentar os dois clusters.",
  coverageContribution: "Conecta os clusters de boxe e Muay Thai.",
  briefingMarkdown: `## Objetivo
Comparar as modalidades de forma neutra: golpes permitidos, regras, treino e objetivos.

## Atenção
Não transformar em escolha de turma. A decisão do leitor não depende da academia.`,
  outlineMarkdown: `## Resumo da diferença
## Golpes e regras
## Como é o treino em cada modalidade
## Qual escolher para cada objetivo`,
  plannedLinks: [],
  researchEvidence: [],
  relatedContent: [
    {
      id: "rc-2",
      title: "(Exemplo) Muay Thai ou boxe: qual escolher?",
      url: "https://altovaletopteam.com.br/exemplo/muay-thai-ou-boxe",
      note: "Sobreposição SIMULADA para demonstração. Nenhuma auditoria de duplicidade foi executada.",
      overlap: "simulada",
      isDemo: true,
    },
  ],
  priority: "media",
  status: "sugerida",
  isDemo: true,
  origin: { kind: "demonstracao", label: "Sugestão demonstrativa do agente Planejador" },
  createdAt: T.d28,
  updatedAt: T.d28,
};

const pLuvas: Pauta = {
  id: "pauta-luvas",
  projectId: AVTT_ID,
  revision: 1,
  title: "Como escolher luvas de boxe para treinar",
  primaryKeyword: "como escolher luvas de boxe",
  secondaryKeywords: ["luva de boxe oz", "tamanho de luva de boxe"],
  intent: "informacional",
  audience: "Iniciantes que vão comprar o primeiro par de luvas.",
  question: "Qual luva de boxe comprar para começar a treinar?",
  cluster: "Boxe — equipamentos",
  rationale: "[Demonstração] Dúvida prática frequente de quem inicia.",
  coverageContribution: "Inicia o subcluster de equipamentos.",
  briefingMarkdown: `## Objetivo
Explicar critérios de escolha (peso em onças, fechamento, uso) sem indicar marcas.`,
  outlineMarkdown: `## O que significa o peso da luva
## Velcro ou cadarço
## Luva de saco x luva de treino
## Cuidados e higiene`,
  plannedLinks: [{ id: "pl-4", anchor: "fundamentos do boxe", url: "/blog/fundamentos-do-boxe-para-iniciantes" }],
  researchEvidence: [],
  relatedContent: [],
  owner: "Revisora editorial (demo)",
  priority: "media",
  status: "aprovada",
  articleId: "art-luvas",
  isDemo: true,
  origin: { kind: "demonstracao", label: "Sugestão demonstrativa do agente Planejador" },
  createdAt: T.d20,
  updatedAt: T.d22,
};

const pAulaLocal: Pauta = {
  id: "pauta-aula-experimental",
  projectId: AVTT_ID,
  revision: 1,
  title: "Aula experimental de Muay Thai em Rio do Sul: o que esperar",
  primaryKeyword: "aula experimental muay thai rio do sul",
  secondaryKeywords: [],
  intent: "local",
  audience: "Pessoas da região de Rio do Sul/SC avaliando uma primeira aula.",
  question: "Como funciona uma aula experimental e o que levar?",
  cluster: "Institucional / local",
  rationale: "[Demonstração] Única pauta local do exemplo: só faz sentido se a pesquisa confirmar intenção local.",
  coverageContribution: "Página de apoio para buscas locais.",
  briefingMarkdown: `## Objetivo
Explicar o que esperar de uma aula experimental. Horários e regras devem vir das informações do cliente.`,
  outlineMarkdown: `## Como funciona
## O que levar
## Perguntas frequentes`,
  plannedLinks: [],
  researchEvidence: [],
  relatedContent: [],
  priority: "baixa",
  status: "devolvida",
  isDemo: true,
  origin: { kind: "demonstracao", label: "Sugestão demonstrativa do agente Planejador" },
  createdAt: T.d24,
  updatedAt: T.d26,
};

/* ---------------- Artigo: Fundamentos do boxe -------------------- */

const ARTICLE_BOXE_V1 = `# Fundamentos do boxe para iniciantes

Os fundamentos do boxe são a base técnica que sustenta todo o resto: a forma de ficar em guarda, de se deslocar, de golpear e de se defender. Quem começa por eles evolui com mais segurança e aproveita melhor cada treino.

## O que são os fundamentos do boxe

Chamamos de fundamentos o conjunto de habilidades que aparecem em praticamente todos os momentos de uma luta ou de um treino. Eles incluem:

- guarda e postura;
- base e deslocamento;
- golpes básicos;
- defesa e respiração.

Dominar esses pontos não exige força ou condicionamento elevados no início. Exige repetição, atenção aos detalhes e orientação de quem já treina há bastante tempo.

## Guarda e postura

A guarda é a posição em que o praticante fica pronto para atacar e se defender ao mesmo tempo. As mãos ficam próximas ao rosto, os cotovelos protegem a linha da cintura e o queixo fica levemente recolhido.

Uma guarda bem feita reduz a área exposta e permite reagir rápido. No começo, é normal baixar as mãos ao cansar; por isso a guarda é corrigida desde a primeira aula.

## Base e deslocamento

A base é a posição dos pés. Em geral, os pés ficam afastados mais ou menos na largura dos ombros, um à frente do outro, com o peso distribuído entre as duas pernas e os joelhos levemente flexionados para que o corpo consiga se mover em qualquer direção sem perder o equilíbrio, o que é fundamental porque o deslocamento ruim compromete tanto o ataque quanto a defesa e é um dos pontos que mais aparecem nas correções dos primeiros meses de treino.

O deslocamento acontece em passos curtos, sem cruzar as pernas. A ideia é manter a base mesmo em movimento.

## Os golpes básicos

Quatro golpes formam o repertório inicial:

1. **Jab** — golpe reto com a mão da frente, usado para medir distância e abrir espaço.
2. **Direto** — golpe reto com a mão de trás, com rotação do quadril.
3. **Cruzado** — golpe circular na altura da cabeça.
4. **Uppercut** — golpe de baixo para cima, em curta distância.

Cada golpe começa e termina na guarda. Voltar a mão para proteger o rosto é tão importante quanto acertar.

## Defesa e respiração

As defesas iniciais incluem bloqueios com as luvas e antebraços, esquivas com movimento do tronco e o uso do deslocamento para sair da linha de ataque.

A respiração acompanha os golpes: soltar o ar a cada golpe ajuda a manter o ritmo e evita tensão desnecessária.

## Erros comuns de iniciantes

- Baixar a guarda depois de golpear.
- Cruzar as pernas no deslocamento.
- Prender a respiração.
- Querer força antes de técnica.

## Perguntas frequentes

**Preciso estar em forma para começar?**
Não. O condicionamento é construído com o treino.

**Quanto tempo leva para aprender os fundamentos?**
Varia de pessoa para pessoa e da frequência de treino.

Leia também: [diferenças entre boxe e Muay Thai](/blog/diferencas-entre-boxe-e-muay-thai) e [como escolher luvas de boxe](/blog/como-escolher-luvas-de-boxe).
`;

const RUN_BOXE = "run-demo-redator-001";

const runBoxe: WorkflowRun = {
  id: RUN_BOXE,
  projectId: AVTT_ID,
  agent: "redator",
  workflowName: "Redação (exemplo)",
  originalStatuses: ["revisao_obrigatoria_legibilidade", "revisao_obrigatoria_fontes"],
  receivedAt: T.d26,
  hasRetrievalReceipt: true,
  technical: {
    warnings: ["[Demonstração] Parágrafo extenso na seção “Base e deslocamento”."],
    readability: {
      summary: "[Demonstração] Revisão de legibilidade solicitada pelo workflow.",
      reasons: [
        "[Demonstração] Frase com mais de 60 palavras em “Base e deslocamento”.",
        "[Demonstração] Seção “Perguntas frequentes” com respostas curtas demais.",
      ],
    },
    controle: { execucao: RUN_BOXE, modelo: "não informado na demonstração" },
  },
  isDemo: true,
  origin: { kind: "demonstracao", label: "Execução simulada do agente Redator (nenhum workflow foi chamado)" },
};

const vBoxe1: ArticleVersion = {
  id: "ver-boxe-1",
  articleId: "art-fundamentos-boxe",
  number: 1,
  markdown: ARTICLE_BOXE_V1,
  createdAt: T.d26,
  createdBy: "Agente Redator (simulado)",
  origin: { kind: "demonstracao", label: "Saída simulada do agente Redator — texto demonstrativo, não revisado" },
  runId: RUN_BOXE,
  changeNote: "Primeira versão recebida (simulada).",
  briefing: snapshotBriefing(pFundamentosBoxe, T.d24),
  aiReview: {
    summary: "[Demonstração] Parecer auxiliar simulado do agente Revisor. Não substitui revisão humana.",
    points: [
      "Sugere dividir o parágrafo longo da seção “Base e deslocamento”.",
      "Aponta que a seção “Os golpes básicos” não tem trecho de fonte de domínio associado.",
      "Sugere ampliar as respostas das perguntas frequentes.",
    ],
    runId: RUN_BOXE,
    isDemo: true,
  },
};

const artBoxe: Article = {
  id: "art-fundamentos-boxe",
  projectId: AVTT_ID,
  pautaId: pFundamentosBoxe.id,
  title: pFundamentosBoxe.title,
  primaryKeyword: pFundamentosBoxe.primaryKeyword,
  currentVersionId: vBoxe1.id,
  versions: [vBoxe1],
  isDemo: true,
  createdAt: T.d24,
  updatedAt: T.d26,
};

/* ---------------- Artigo: Luvas (sem recibo de recuperação) ------- */

const RUN_LUVAS = "run-demo-redator-002";

const runLuvas: WorkflowRun = {
  id: RUN_LUVAS,
  projectId: AVTT_ID,
  agent: "redator",
  workflowName: "Redação (exemplo)",
  originalStatuses: ["aguardando_revisao_humana"],
  receivedAt: T.d22,
  hasRetrievalReceipt: false,
  technical: {},
  isDemo: true,
  origin: { kind: "demonstracao", label: "Execução simulada do agente Redator, sem recibo de trechos" },
};

const vLuvas1: ArticleVersion = {
  id: "ver-luvas-1",
  articleId: "art-luvas",
  number: 1,
  markdown: `# Como escolher luvas de boxe para treinar

Escolher a primeira luva parece simples, mas alguns critérios fazem diferença no conforto e na proteção das mãos.

## O que significa o peso da luva

O peso é indicado em onças (oz). Luvas mais pesadas têm mais enchimento e costumam ser usadas em treinos com parceiro. A escolha depende do tipo de treino e deve ser orientada pela equipe.

## Velcro ou cadarço

O fechamento em velcro é mais prático para treinar sozinho. O cadarço oferece ajuste firme, mas exige ajuda para amarrar.

## Luva de saco x luva de treino

Luvas de saco são mais compactas. Luvas de treino servem para várias atividades, inclusive treino com parceiro.

## Cuidados e higiene

Deixe a luva secar ao ar depois do treino e use bandagem por baixo.
`,
  createdAt: T.d22,
  createdBy: "Agente Redator (simulado)",
  origin: { kind: "demonstracao", label: "Saída simulada do agente Redator — texto demonstrativo, não revisado" },
  runId: RUN_LUVAS,
  changeNote: "Primeira versão recebida (simulada).",
  briefing: snapshotBriefing(pLuvas, T.d22),
};

const artLuvas: Article = {
  id: "art-luvas",
  projectId: AVTT_ID,
  pautaId: pLuvas.id,
  title: pLuvas.title,
  primaryKeyword: pLuvas.primaryKeyword,
  currentVersionId: vLuvas1.id,
  versions: [vLuvas1],
  isDemo: true,
  createdAt: T.d22,
  updatedAt: T.d22,
};

const avttDecisions: Decision[] = [
  {
    id: "dec-p-boxe",
    projectId: AVTT_ID,
    target: { kind: "pauta", pautaId: pFundamentosBoxe.id, pautaRevision: 1 },
    kind: "pauta_aprovada",
    reviewerId: "rev-marcos",
    reviewerName: "Marcos",
    reviewerRole: "editor",
    comment: "[Demonstração] Pauta aprovada para redação.",
    createdAt: T.d24,
  } satisfies PautaDecision,
  {
    id: "dec-p-luvas",
    projectId: AVTT_ID,
    target: { kind: "pauta", pautaId: pLuvas.id, pautaRevision: 1 },
    kind: "pauta_aprovada",
    reviewerId: "rev-editora",
    reviewerName: "Revisora editorial (demo)",
    reviewerRole: "editor",
    createdAt: T.d22,
  } satisfies PautaDecision,
  {
    id: "dec-p-aula",
    projectId: AVTT_ID,
    target: { kind: "pauta", pautaId: pAulaLocal.id, pautaRevision: 1 },
    kind: "pauta_devolvida",
    reviewerId: "rev-marcos",
    reviewerName: "Marcos",
    reviewerRole: "editor",
    comment: "[Demonstração] Confirmar com pesquisa se existe intenção local antes de seguir. Horários precisam vir das informações do cliente.",
    createdAt: T.d26,
  } satisfies PautaDecision,
  {
    id: "dec-a-luvas-ed",
    projectId: AVTT_ID,
    target: { kind: "artigo", articleId: artLuvas.id, versionId: vLuvas1.id, versionNumber: 1 },
    kind: "aprovacao_editorial",
    reviewerId: "rev-editora",
    reviewerName: "Revisora editorial (demo)",
    reviewerRole: "editor",
    comment: "[Demonstração] Texto claro. Encaminhar ao professor para conferir as orientações técnicas.",
    createdAt: T.d29,
  } satisfies ArticleDecision,
];

const avttComments: Comment[] = [
  {
    id: "com-aula",
    projectId: AVTT_ID,
    target: { kind: "pauta", pautaId: pAulaLocal.id },
    body: "[Demonstração] Confirmar com pesquisa se existe intenção local antes de seguir. Horários precisam vir das informações do cliente.",
    authorId: "rev-marcos",
    authorName: "Marcos",
    createdAt: T.d26,
    type: "observacao",
    status: "aberto",
  },
  {
    id: "com-boxe-1",
    projectId: AVTT_ID,
    target: { kind: "artigo", articleId: artBoxe.id, versionId: vBoxe1.id, versionNumber: 1 },
    section: "Os golpes básicos",
    body: "[Demonstração] Conferir com o professor se a nomenclatura dos golpes segue a usada nas aulas.",
    authorId: "rev-editora",
    authorName: "Revisora editorial (demo)",
    createdAt: T.d27,
    type: "observacao",
    status: "aberto",
  },
];

const avttFlags: QualityFlag[] = [
  {
    id: "qf-boxe-leg",
    articleId: artBoxe.id,
    kind: "legibilidade",
    reasons: runBoxe.technical.readability?.reasons ?? [],
    detectedInVersionId: vBoxe1.id,
    originalStatus: "revisao_obrigatoria_legibilidade",
    runId: RUN_BOXE,
    status: "aberta",
    isDemo: true,
    origin: { kind: "demonstracao", label: "Pendência gerada pela execução simulada" },
  },
  {
    id: "qf-boxe-fontes",
    articleId: artBoxe.id,
    kind: "fontes",
    reasons: ["[Demonstração] Seção “Os golpes básicos” sem trecho de fonte de domínio associado."],
    detectedInVersionId: vBoxe1.id,
    originalStatus: "revisao_obrigatoria_fontes",
    runId: RUN_BOXE,
    status: "aberta",
    isDemo: true,
    origin: { kind: "demonstracao", label: "Pendência gerada pela execução simulada" },
  },
];

const avttLibrary: LibrarySource[] = [
  {
    id: "lib-backlinko",
    projectId: AVTT_ID,
    category: "metodo",
    title: "Backlinko",
    url: "https://backlinko.com/",
    description: "Referência de método editorial/SEO cadastrada pela equipe. Cadastro demonstrativo; nenhum trecho foi importado.",
    registeredAt: T.d20,
    isDemo: true,
    origin: DEMO,
  },
  {
    id: "lib-dominio-exemplo",
    projectId: AVTT_ID,
    category: "dominio",
    title: "Base de fatos do assunto — exemplo",
    url: "https://example.com/demo/base-de-fatos",
    description: "Fonte fictícia usada para demonstrar a separação entre biblioteca e recibo de uso.",
    registeredAt: T.d20,
    isDemo: true,
    origin: DEMO,
  },
  {
    id: "lib-avtt-perfil-identidade",
    projectId: AVTT_ID,
    category: "cliente",
    title: "Perfil da academia — Identidade",
    description: "Trecho importado de arquivo real do projeto de atendimento da AVTT.",
    excerpt:
      "Alto Vale Top Team e uma academia de artes marciais em Rio do Sul/SC, especializada em Muay Thai e Boxe.",
    registeredAt: T.d30,
    isDemo: false,
    origin: { kind: "importado", label: "Importado de arquivo do projeto (texto literal)", ref: AVTT_PROFILE_REF },
  },
  {
    id: "lib-avtt-perfil-nomes",
    projectId: AVTT_ID,
    category: "cliente",
    title: "Perfil da academia — Regra sobre nomes",
    description: "Regra editorial do cliente, importada de arquivo real do projeto.",
    excerpt:
      "Nao citar nomes de professores, lutadores, alunos ou funcionarios. Usar termos genericos como \"nossa equipe\", \"professores experientes\" ou \"a equipe da Alto Vale\".",
    registeredAt: T.d30,
    isDemo: false,
    origin: { kind: "importado", label: "Importado de arquivo do projeto (texto literal)", ref: AVTT_PROFILE_REF },
  },
];

const avttChunks: RetrievedChunk[] = [
  {
    id: "chk-1",
    runId: RUN_BOXE,
    category: "dominio",
    librarySourceId: "lib-dominio-exemplo",
    title: "Base de fatos do assunto — exemplo",
    url: "https://example.com/demo/base-de-fatos#guarda",
    text: "[Trecho demonstrativo] Aqui aparece o texto exato que o agente recebeu da base de fatos. Exemplo fictício: descrição da guarda — mãos próximas ao rosto, cotovelos fechados e queixo recolhido.",
    chunkId: "demo-dom-0001",
    retrievedAt: "2026-10-26T16:38:12.000Z",
    similarity: 0.78,
    isDemo: true,
    origin: { kind: "demonstracao", label: "Recibo simulado da execução" },
  },
  {
    id: "chk-2",
    runId: RUN_BOXE,
    category: "dominio",
    librarySourceId: "lib-dominio-exemplo",
    title: "Base de fatos do assunto — exemplo",
    url: "https://example.com/demo/base-de-fatos#base",
    text: "[Trecho demonstrativo] Exemplo fictício: posição dos pés na base, afastados aproximadamente na largura dos ombros. Este trecho não traz similaridade porque o dado de origem não informou.",
    chunkId: "demo-dom-0002",
    retrievedAt: "2026-10-26T16:38:12.000Z",
    isDemo: true,
    origin: { kind: "demonstracao", label: "Recibo simulado da execução" },
  },
  {
    id: "chk-3",
    runId: RUN_BOXE,
    category: "metodo",
    title: "Guia de método editorial — exemplo",
    url: "https://example.com/demo/metodo-editorial",
    text: "[Trecho demonstrativo] Exemplo fictício de orientação de método: responder a pergunta principal logo no primeiro parágrafo e usar subtítulos que correspondam às dúvidas do leitor.",
    chunkId: "demo-met-0001",
    retrievedAt: "2026-10-26T16:38:13.000Z",
    isDemo: true,
    origin: { kind: "demonstracao", label: "Recibo simulado da execução" },
  },
];

const avttInventory: InventoryItem[] = [
  { id: "inv-1", title: "(Exemplo) Página inicial", url: "https://altovaletopteam.com.br/", topic: "Institucional", isDemo: true, origin: DEMO, note: "URL do site; o inventário real não foi coletado." },
  { id: "inv-2", title: "(Exemplo) Boxe: benefícios para iniciantes", url: "https://altovaletopteam.com.br/exemplo/boxe-beneficios", topic: "Boxe — fundamentos", isDemo: true, origin: DEMO },
  { id: "inv-3", title: "(Exemplo) Muay Thai ou boxe: qual escolher?", url: "https://altovaletopteam.com.br/exemplo/muay-thai-ou-boxe", topic: "Comparativos de modalidades", isDemo: true, origin: DEMO },
  { id: "inv-4", title: "(Exemplo) Horários das aulas", url: "https://altovaletopteam.com.br/exemplo/horarios", topic: "Institucional / local", isDemo: true, origin: DEMO },
];

function avttWorkspace(): ProjectWorkspace {
  return {
    schemaVersion: 1,
    project: avttProject,
    pautas: [pMuayFeminino, pFundamentosBoxe, pDiferencas, pLuvas, pAulaLocal],
    articles: [artBoxe, artLuvas],
    comments: avttComments,
    decisions: avttDecisions,
    qualityFlags: avttFlags,
    runs: [runBoxe, runLuvas],
    library: avttLibrary,
    chunks: avttChunks,
    inventory: avttInventory,
    activity: [
      { id: "act-1", projectId: AVTT_ID, type: "aprovacao", at: T.d24, actorName: "Marcos", summary: "Pauta aprovada (rev. 1): “Fundamentos do boxe para iniciantes”", link: { kind: "pauta", pautaId: pFundamentosBoxe.id } },
      { id: "act-2", projectId: AVTT_ID, type: "devolucao", at: T.d26, actorName: "Marcos", summary: "Pauta devolvida: “Aula experimental de Muay Thai em Rio do Sul: o que esperar”", link: { kind: "pauta", pautaId: pAulaLocal.id } },
      { id: "act-3", projectId: AVTT_ID, type: "criacao", at: T.d26, actorName: "Agente Redator (simulado)", summary: "Versão v1 recebida (simulada): “Fundamentos do boxe para iniciantes”", link: { kind: "artigo", articleId: artBoxe.id } },
      { id: "act-4", projectId: AVTT_ID, type: "comentario", at: T.d27, actorName: "Revisora editorial (demo)", summary: "Comentário na v1: “Fundamentos do boxe para iniciantes”", link: { kind: "artigo", articleId: artBoxe.id, tab: "comentarios" } },
      { id: "act-5", projectId: AVTT_ID, type: "aprovacao", at: T.d29, actorName: "Revisora editorial (demo)", summary: "Aprovação editorial da v1: “Como escolher luvas de boxe para treinar”", link: { kind: "artigo", articleId: artLuvas.id, tab: "historico" } },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Segundo projeto (fictício) — demonstra a separação de dados          */
/* ------------------------------------------------------------------ */

const CAFE_ID = "demo-cafe";

function cafeWorkspace(): ProjectWorkspace {
  const project: Project = {
    id: CAFE_ID,
    name: "Projeto exemplo — Café",
    shortName: "Exemplo",
    siteUrl: "https://example.com/",
    audience: "[Demonstração] Pessoas que preparam café em casa.",
    editorialDirection: "[Demonstração] Projeto fictício para conferir a separação de dados entre clientes.",
    technicalOwner: "A definir (preencher)",
    requiresSpecialistReview: false,
    integrations: integrations(),
    isDemo: true,
    origin: DEMO,
    createdAt: T.d20,
    updatedAt: T.d20,
  };
  const p1: Pauta = {
    id: "pauta-cafe-coado",
    projectId: CAFE_ID,
    revision: 1,
    title: "Como preparar café coado em casa",
    primaryKeyword: "como fazer café coado",
    secondaryKeywords: [],
    intent: "informacional",
    audience: "Iniciantes no preparo de café.",
    question: "Qual o passo a passo do café coado?",
    cluster: "Preparo",
    rationale: "[Demonstração] Pauta fictícia.",
    coverageContribution: "[Demonstração]",
    briefingMarkdown: "## Objetivo\nPasso a passo simples.",
    outlineMarkdown: "## Materiais\n## Passo a passo",
    plannedLinks: [],
    researchEvidence: [],
    relatedContent: [],
    priority: "media",
    status: "sugerida",
    isDemo: true,
    origin: DEMO,
    createdAt: T.d27,
    updatedAt: T.d27,
  };
  return {
    schemaVersion: 1,
    project,
    pautas: [p1],
    articles: [],
    comments: [],
    decisions: [],
    qualityFlags: [],
    runs: [],
    library: [],
    chunks: [],
    inventory: [],
    activity: [],
  };
}

export function buildSeedWorkspaces(): ProjectWorkspace[] {
  // structuredClone garante que cada carga parta de uma cópia limpa.
  return [structuredClone(avttWorkspace()), structuredClone(cafeWorkspace())];
}
