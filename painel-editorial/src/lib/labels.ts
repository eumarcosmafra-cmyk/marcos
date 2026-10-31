import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileEdit,
  GraduationCap,
  Inbox,
  RotateCcw,
  Send,
  ShieldCheck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ArticleStage } from "@/domain/rules";
import type {
  AdjustmentStage,
  AgentStage,
  PautaStatus,
  Priority,
  ReviewerRole,
  SearchIntent,
  SourceCategory,
} from "@/domain/types";

export type Tone = "neutral" | "info" | "warning" | "danger" | "success" | "brand";

export interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
  description: string;
}

export const PAUTA_STATUS: Record<PautaStatus, StatusMeta> = {
  sugerida: { label: "Pauta sugerida", tone: "neutral", icon: Inbox, description: "Aguardando início da revisão." },
  em_revisao: { label: "Pauta em revisão", tone: "info", icon: Clock3, description: "Aguardando decisão: aprovar ou devolver." },
  devolvida: { label: "Pauta devolvida", tone: "warning", icon: Undo2, description: "Devolvida com comentário; precisa de ajuste." },
  aprovada: { label: "Pauta aprovada", tone: "success", icon: CheckCircle2, description: "Aprovada para redação. Não aprova o artigo." },
};

export const PAUTA_STATUS_ORDER: PautaStatus[] = ["sugerida", "em_revisao", "devolvida", "aprovada"];

export const ARTICLE_STAGE: Record<ArticleStage, StatusMeta> = {
  rascunho: { label: "Rascunho", tone: "neutral", icon: CircleDashed, description: "Ainda sem versão para revisão." },
  revisao_editorial: { label: "Revisão editorial", tone: "info", icon: FileEdit, description: "Versão atual aguarda revisão editorial." },
  ajustes_solicitados: { label: "Ajustes solicitados", tone: "warning", icon: RotateCcw, description: "A versão atual foi devolvida; é preciso nova versão." },
  revisao_especialista: { label: "Revisão do especialista", tone: "brand", icon: GraduationCap, description: "Aguarda revisão do especialista/professor." },
  aguardando_aprovacao_final: { label: "Aguardando aprovação final", tone: "brand", icon: Send, description: "Revisões concluídas; falta a aprovação final." },
  aprovado_publicacao: { label: "Aprovado para publicação", tone: "success", icon: ShieldCheck, description: "Aprovado por decisão humana. Ainda não publicado." },
  publicado: { label: "Publicado", tone: "success", icon: CheckCircle2, description: "Publicação confirmada com URL e data." },
};

export const ARTICLE_STAGE_ORDER: ArticleStage[] = [
  "rascunho",
  "revisao_editorial",
  "ajustes_solicitados",
  "revisao_especialista",
  "aguardando_aprovacao_final",
  "aprovado_publicacao",
];

export const INTENT_LABEL: Record<SearchIntent, string> = {
  informacional: "Informacional",
  comercial: "Comercial",
  transacional: "Transacional",
  navegacional: "Navegacional",
  local: "Local",
};

export const PRIORITY_LABEL: Record<Priority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

export const ADJUSTMENT_STAGE_LABEL: Record<AdjustmentStage, string> = {
  pesquisa: "Pesquisa",
  briefing: "Briefing",
  redacao: "Redação",
  revisao: "Revisão",
};

export const ROLE_LABEL: Record<ReviewerRole, string> = {
  editor: "Editor(a)",
  especialista: "Especialista / professor",
  gestor: "Gestão",
};

export const SOURCE_CATEGORY: Record<SourceCategory, { label: string; description: string }> = {
  dominio: {
    label: "Fatos do assunto",
    description: "Fontes que sustentam afirmações sobre esporte, personagens, datas ou outros temas.",
  },
  metodo: {
    label: "Método editorial/SEO",
    description: "Referências usadas para orientar pesquisa, estrutura e escrita.",
  },
  cliente: {
    label: "Informações do cliente",
    description: "Dados e trechos do site ou de documentos fornecidos pelo cliente.",
  },
};

export const AGENT_STAGES: { key: AgentStage; label: string; role: string }[] = [
  { key: "analista", label: "Analista", role: "Lê o contexto do cliente e do site para orientar o planejamento." },
  { key: "planejador", label: "Planejador", role: "Propõe pautas, clusters e justificativas." },
  { key: "pesquisador", label: "Pesquisador", role: "Reúne evidências de pesquisa e fontes do assunto." },
  { key: "redator", label: "Redator", role: "Produz briefing e rascunho do artigo." },
  { key: "revisor", label: "Revisor", role: "Emite parecer auxiliar (não substitui a revisão humana)." },
];

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-slate-300 bg-slate-50 text-slate-800",
  info: "border-sky-300 bg-sky-50 text-sky-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  danger: "border-red-300 bg-red-50 text-red-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  brand: "border-indigo-300 bg-indigo-50 text-indigo-900",
};
