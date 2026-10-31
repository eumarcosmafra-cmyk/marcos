/**
 * Contratos do domínio editorial.
 *
 * Estes tipos descrevem o que a interface precisa. Eles NÃO presumem que existam
 * tabelas com esses nomes no Supabase: o adaptador futuro (ver INTEGRACAO_FUTURA.md)
 * é responsável por traduzir as estruturas reais para estes contratos.
 */

export type ID = string;
/** Data/hora em ISO 8601 (UTC). */
export type ISODateTime = string;
/** Data de calendário (AAAA-MM-DD), sem horário. */
export type ISODate = string;

/** De onde veio um dado. Toda informação exibida carrega a sua origem. */
export interface Origin {
  kind: "demonstracao" | "manual" | "importado" | "workflow";
  /** Texto curto exibido na interface. */
  label: string;
  /** Referência rastreável (arquivo, commit, id de execução). */
  ref?: string;
}

/* ------------------------------------------------------------------ */
/* Projeto                                                             */
/* ------------------------------------------------------------------ */

export type IntegrationKey = "n8n" | "supabase" | "site";

export interface IntegrationState {
  key: IntegrationKey;
  label: string;
  /** Nesta entrega nenhuma integração está conectada. */
  status: "nao_conectado";
  note: string;
}

export interface Project {
  id: ID;
  name: string;
  shortName: string;
  siteUrl: string;
  siteStack?: string;
  location?: string;
  audience: string;
  editorialDirection: string;
  technicalOwner: string;
  /** Exige revisão de especialista/professor antes da aprovação final. */
  requiresSpecialistReview: boolean;
  integrations: IntegrationState[];
  isDemo: boolean;
  origin: Origin;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface InventoryItem {
  id: ID;
  title: string;
  url: string;
  topic: string;
  note?: string;
  isDemo: boolean;
  origin: Origin;
}

/* ------------------------------------------------------------------ */
/* Pauta                                                               */
/* ------------------------------------------------------------------ */

export type PautaStatus = "sugerida" | "em_revisao" | "devolvida" | "aprovada";
export type SearchIntent = "informacional" | "comercial" | "transacional" | "navegacional" | "local";
export type Priority = "alta" | "media" | "baixa";

export interface PlannedLink {
  id: ID;
  anchor: string;
  url: string;
  note?: string;
}

export interface ResearchEvidence {
  id: ID;
  /** Ferramenta ou base de onde veio a evidência. */
  source: string;
  locality?: string;
  collectedAt?: ISODate;
  summary: string;
  url?: string;
  isDemo: boolean;
}

export interface RelatedContent {
  id: ID;
  title: string;
  url: string;
  note: string;
  /**
   * Situação da análise de sobreposição. "simulada" = exemplo da demonstração,
   * sem auditoria real. "nao_avaliada" = ninguém avaliou ainda.
   */
  overlap: "simulada" | "nao_avaliada" | "avaliada_manualmente";
  isDemo: boolean;
}

export interface Pauta {
  id: ID;
  projectId: ID;
  /** Incrementa a cada alteração salva. Decisões referenciam a revisão. */
  revision: number;
  title: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: SearchIntent;
  audience: string;
  question: string;
  cluster: string;
  rationale: string;
  coverageContribution: string;
  briefingMarkdown: string;
  outlineMarkdown: string;
  plannedLinks: PlannedLink[];
  researchEvidence: ResearchEvidence[];
  relatedContent: RelatedContent[];
  owner?: string;
  /** Data editorial planejada. NÃO é agendamento de publicação. */
  plannedDate?: ISODate;
  priority: Priority;
  status: PautaStatus;
  articleId?: ID;
  isDemo: boolean;
  origin: Origin;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type PautaInput = Omit<
  Pauta,
  "id" | "projectId" | "revision" | "status" | "articleId" | "createdAt" | "updatedAt" | "origin" | "isDemo"
>;

/* ------------------------------------------------------------------ */
/* Execuções de workflow e fontes                                      */
/* ------------------------------------------------------------------ */

export type AgentStage = "analista" | "planejador" | "pesquisador" | "redator" | "revisor";

/** Status originais emitidos pelos workflows (preservados no registro técnico). */
export type KnownWorkflowStatus =
  | "aguardando_revisao_humana"
  | "revisao_obrigatoria_legibilidade"
  | "revisao_obrigatoria_fontes";

export interface WorkflowRun {
  id: ID;
  projectId: ID;
  agent: AgentStage;
  workflowName: string;
  /** Status exatamente como veio do workflow. Nunca é uma decisão humana. */
  originalStatuses: string[];
  receivedAt: ISODateTime;
  /**
   * Indica se a execução trouxe o recibo dos trechos efetivamente recebidos
   * pelo agente. Sem recibo, nenhuma fonte pode ser dada como utilizada.
   */
  hasRetrievalReceipt: boolean;
  /** Campos técnicos complementares (palavras, avisos, legibilidade). */
  technical: {
    words?: number;
    warnings?: string[];
    readability?: { summary?: string; reasons?: string[] };
    controle?: Record<string, string | number | boolean>;
  };
  isDemo: boolean;
  origin: Origin;
}

export type SourceCategory = "dominio" | "metodo" | "cliente";

/** Fonte cadastrada na biblioteca. Existir na biblioteca não prova uso. */
export interface LibrarySource {
  id: ID;
  projectId: ID;
  category: SourceCategory;
  title: string;
  url?: string;
  description: string;
  /** Trecho de referência guardado na biblioteca (não é recibo de uso). */
  excerpt?: string;
  registeredAt: ISODateTime;
  isDemo: boolean;
  origin: Origin;
}

/** Trecho efetivamente recebido pelo agente em uma execução específica. */
export interface RetrievedChunk {
  id: ID;
  runId: ID;
  category: SourceCategory;
  librarySourceId?: ID;
  title?: string;
  url?: string;
  text: string;
  chunkId?: string;
  retrievedAt?: ISODateTime;
  /** Só existe quando veio no dado original. Nunca é calculada aqui. */
  similarity?: number;
  isDemo: boolean;
  origin: Origin;
}

/* ------------------------------------------------------------------ */
/* Artigo e versões                                                    */
/* ------------------------------------------------------------------ */

export interface BriefingSnapshot {
  pautaId: ID;
  pautaRevision: number;
  title: string;
  primaryKeyword: string;
  intent: SearchIntent;
  audience: string;
  question: string;
  briefingMarkdown: string;
  outlineMarkdown: string;
  plannedLinks: PlannedLink[];
  capturedAt: ISODateTime;
}

export interface AiReviewNote {
  /** Parecer auxiliar. Nunca preenche decisão humana. */
  summary: string;
  points: string[];
  runId?: ID;
  isDemo: boolean;
}

export interface ArticleVersion {
  id: ID;
  articleId: ID;
  number: number;
  markdown: string;
  createdAt: ISODateTime;
  createdBy: string;
  origin: Origin;
  /** Versão a partir da qual esta foi editada. */
  basedOnVersionId?: ID;
  changeNote?: string;
  /** Execução de workflow que gerou o texto, quando houver. */
  runId?: ID;
  briefing: BriefingSnapshot;
  aiReview?: AiReviewNote;
}

export interface PublicationRecord {
  url: string;
  publishedAt: ISODate;
  confirmedAt: ISODateTime;
  confirmedBy: string;
  versionId: ID;
}

export interface Article {
  id: ID;
  projectId: ID;
  pautaId: ID;
  title: string;
  primaryKeyword: string;
  currentVersionId?: ID;
  versions: ArticleVersion[];
  /** Publicação só existe com confirmação real (URL + data). */
  publication?: PublicationRecord;
  isDemo: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Pendências de qualidade                                             */
/* ------------------------------------------------------------------ */

export type QualityFlagKind = "legibilidade" | "fontes";

export interface QualityFlag {
  id: ID;
  articleId: ID;
  kind: QualityFlagKind;
  reasons: string[];
  detectedInVersionId: ID;
  /** Status original do workflow que gerou a pendência. */
  originalStatus?: string;
  runId?: ID;
  status: "aberta" | "resolvida";
  resolvedAt?: ISODateTime;
  resolvedBy?: string;
  resolvedInVersionId?: ID;
  resolutionNote?: string;
  isDemo: boolean;
  origin: Origin;
}

/* ------------------------------------------------------------------ */
/* Comentários e decisões humanas                                      */
/* ------------------------------------------------------------------ */

export type AdjustmentStage = "pesquisa" | "briefing" | "redacao" | "revisao";

export interface Comment {
  id: ID;
  projectId: ID;
  target: { kind: "pauta"; pautaId: ID } | { kind: "artigo"; articleId: ID; versionId: ID; versionNumber: number };
  /** Seção (título do Markdown) a que o comentário se refere. Vazio = geral. */
  section?: string;
  body: string;
  authorId: ID;
  authorName: string;
  createdAt: ISODateTime;
  /** Comentário simples ou pedido de ajuste. */
  type: "observacao" | "ajuste";
  adjustmentStage?: AdjustmentStage;
  status: "aberto" | "resolvido";
  resolvedAt?: ISODateTime;
  resolvedBy?: string;
  resolvedInVersionId?: ID;
  resolutionNote?: string;
}

export type ReviewerRole = "editor" | "especialista" | "gestor";

export interface ReviewerIdentity {
  id: ID;
  name: string;
  role: ReviewerRole;
  /** Na demonstração toda identidade é local, sem autenticação. */
  isLocal: true;
}

export type PautaDecisionKind = "pauta_aprovada" | "pauta_devolvida" | "pauta_enviada_revisao";
export type ArticleDecisionKind =
  | "ajustes_solicitados"
  | "aprovacao_editorial"
  | "revisao_especialista"
  | "aprovacao_final";

export interface PautaDecision {
  id: ID;
  projectId: ID;
  target: { kind: "pauta"; pautaId: ID; pautaRevision: number };
  kind: PautaDecisionKind;
  reviewerId: ID;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  comment?: string;
  createdAt: ISODateTime;
}

export interface ArticleDecision {
  id: ID;
  projectId: ID;
  /** Toda decisão de artigo referencia uma versão específica. */
  target: { kind: "artigo"; articleId: ID; versionId: ID; versionNumber: number };
  kind: ArticleDecisionKind;
  reviewerId: ID;
  reviewerName: string;
  reviewerRole: ReviewerRole;
  comment: string;
  adjustmentStage?: AdjustmentStage;
  /** Para revisão do especialista. */
  specialistOutcome?: "aprovado" | "aprovado_com_observacoes";
  createdAt: ISODateTime;
}

export type Decision = PautaDecision | ArticleDecision;

/* ------------------------------------------------------------------ */
/* Atividade                                                           */
/* ------------------------------------------------------------------ */

export type ActivityType =
  | "comentario"
  | "edicao"
  | "devolucao"
  | "aprovacao"
  | "ajuste"
  | "revisao_especialista"
  | "criacao"
  | "resolucao";

export interface ActivityEvent {
  id: ID;
  projectId: ID;
  type: ActivityType;
  at: ISODateTime;
  actorName: string;
  summary: string;
  link: { kind: "pauta"; pautaId: ID } | { kind: "artigo"; articleId: ID; tab?: string };
}

/* ------------------------------------------------------------------ */
/* Agregado por projeto (unidade de persistência)                      */
/* ------------------------------------------------------------------ */

export interface ProjectWorkspace {
  schemaVersion: 1;
  project: Project;
  pautas: Pauta[];
  articles: Article[];
  comments: Comment[];
  decisions: Decision[];
  qualityFlags: QualityFlag[];
  runs: WorkflowRun[];
  library: LibrarySource[];
  chunks: RetrievedChunk[];
  inventory: InventoryItem[];
  activity: ActivityEvent[];
}
