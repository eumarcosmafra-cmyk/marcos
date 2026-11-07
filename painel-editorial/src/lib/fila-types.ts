/**
 * Formato dos dados reais da fila editorial V2 entregues ao navegador.
 * O servidor do painel monta estes objetos a partir da resposta do n8n,
 * descartando o payload interno (pacote, etapas, operações, uso de API).
 */

export type Ambiente = "producao" | "teste";

export interface ControleDTO {
  aprovacao_editorial: boolean;
  aprovacao_professor: boolean;
  publicacao_autorizada: boolean;
}

export interface DecisaoDTO {
  decisao: "aprovar" | "devolver";
  nome: string;
  tipo_revisao: string;
  versao_artigo: number;
  artigo_sha256: string;
  motivos: string[];
  justificativa_pendencias: string | null;
  em: string;
  simulacao: boolean;
}

export interface VersaoMetaDTO {
  numero: number;
  sha256: string;
  origem: string;
  em: string;
  completa: boolean;
}

export interface HistoricoDTO {
  evento: string;
  em: string | null;
  ator: string | null;
  etapa: string | null;
  simulacao: boolean | null;
  detalhes: Record<string, string | number | boolean>;
}

export interface TrabalhoResumoDTO {
  job_key: string;
  pauta_id: string;
  keyword: string;
  titulo_pauta: string | null;
  titulo_artigo: string | null;
  ambiente: Ambiente;
  modo_execucao: "real" | "simulado" | null;
  estado: string;
  etapa: string;
  revisao: number;
  versao_artigo: number;
  artigo_sha256: string | null;
  pendencias_qtd: number;
  decisao_atual: DecisaoDTO | null;
  controle: ControleDTO;
  em_execucao: boolean;
  atualizado_em: string | null;
}

export interface AcoesDTO {
  pode_editar: boolean;
  pode_aprovar: boolean;
  pode_devolver: boolean;
  exige_avaliacao_pendencias: boolean;
  /** Devolução vigente na versão atual pode virar correção pelo Redator + Revisor. */
  pode_solicitar_correcao: boolean;
  /** Há etapa automática pendente e sem reserva; o produtor pode ser disparado. */
  pode_retomar_producao: boolean;
  /** Etapa de agente reservada ou pendente: edição e decisões ficam bloqueadas. */
  em_producao: boolean;
  bloqueios: string[];
  bloqueios_producao: string[];
}

/** Uso de chamadas de API registrado pela fila (sem valores em reais: a fila não os informa). */
export interface ChamadasDTO {
  reservadas: number;
  com_uso_confirmado: number;
  limite_do_ciclo: number | null;
}

export interface TrabalhoDTO extends TrabalhoResumoDTO {
  artigo_markdown: string | null;
  versoes: VersaoMetaDTO[];
  historico: HistoricoDTO[];
  pendencias: string[];
  pendencias_sha256: string;
  reserva: { etapa: string; em: string; execucao_id: string | null } | null;
  proxima_etapa: string | null;
  chamadas: ChamadasDTO;
  correcao_disponivel: boolean;
  acoes: AcoesDTO;
}

export interface VersaoTextoDTO extends VersaoMetaDTO {
  markdown: string;
  sha256_confere: boolean;
}

export interface ErroApi {
  codigo: string;
  mensagem: string;
  detalhe?: Record<string, unknown>;
}

export type RespostaApi<T> = ({ ok: true } & T) | { ok: false; erro: ErroApi };

/** Estados em que o contrato da fila aceita cada decisão. */
export const ESTADOS_APROVAVEIS = ["aguardando_editor", "pendente_ajustes"];
export const ESTADOS_DEVOLVIVEIS = ["aguardando_editor", "pendente_ajustes", "aprovado_editorial", "aprovacao_simulada", "devolvido"];

/** Etapa que o produtor executa a partir de cada estado (qNextStage da fila). */
export const PROXIMA_ETAPA: Record<string, "pesquisador" | "redator" | "revisor"> = {
  aguardando_briefing: "pesquisador",
  aguardando_redacao: "redator",
  aguardando_revisao: "revisor",
};

/** Chamadas de API reservadas por etapa (iniciar_etapa: revisor = 2, demais = 1). */
export const CHAMADAS_POR_ETAPA: Record<string, number> = { pesquisador: 1, redator: 1, revisor: 2 };

/** preparar_correcao libera exatamente 3 chamadas novas: Redator (1) + Revisor (2). */
export const CHAMADAS_CORRECAO = 3;
