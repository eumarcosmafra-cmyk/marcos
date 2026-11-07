/**
 * Pautas vindas dos planos gravados pelo Planejador (Data Table de contexto do n8n),
 * com o estado da curadoria de fontes e, quando houver, o trabalho na fila.
 */
import type { Ambiente } from "./fila-types";

export type EstadoFontes = "nenhuma" | "proposta" | "insuficiente" | "aprovada";

export interface PreviaFonteDTO {
  id: string;
  url: string;
  dominio: string | null;
  titulo: string;
  entidade: string;
  localizador: string;
  limites: string;
  trecho: string;
  caracteres: number;
}

export interface CandidatoFonteDTO {
  id: string;
  origem: string | null;
  url: string | null;
  dominio: string | null;
  titulo: string | null;
  situacao: string | null;
  motivo: string | null;
  fonte: string | null;
}

export interface FontesPautaDTO {
  estado: EstadoFontes;
  proposta: {
    status: string;
    motivo: string | null;
    gerado_em: string | null;
    previas: PreviaFonteDTO[];
    candidatos: CandidatoFonteDTO[];
    metodo: string | null;
    chamadas_ia: number;
    observacao: string | null;
    urls_extras: string[];
  } | null;
  aprovada_em: string | null;
  documentos: { id: string; url: string; titulo: string; entidade: string; localizador: string; limites: string }[];
}

export interface TrabalhoDaPautaDTO {
  ambiente: Ambiente;
  job_key: string;
  estado: string;
  versao_artigo: number;
}

export interface PautaDTO {
  id: string;
  keyword: string;
  titulo: string;
  acao: string;
  intencao: string | null;
  prioridade: string | null;
  status: string | null;
  tema: string | null;
  justificativa: string | null;
  diferenca_acervo: string | null;
  apuracao_pendente: string[];
  links_internos: string[];
  volume: number | null;
  secundarias: string[];
  serp: { rank: number | null; titulo: string; site: string; url: string; video: boolean }[];
  integra: boolean;
  fontes: FontesPautaDTO;
  trabalhos: TrabalhoDaPautaDTO[];
}

export interface PlanoDTO {
  plano_id: string;
  plano_cache_key: string;
  criado_em: string | null;
  site_url: string | null;
  pautas: PautaDTO[];
}

export interface ListaPautasDTO {
  planos: PlanoDTO[];
  falhas: { cache_key: string; codigo: string }[];
  fila_consultada: boolean;
}
