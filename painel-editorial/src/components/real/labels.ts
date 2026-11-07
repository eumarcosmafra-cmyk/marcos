import {
  AlertOctagon,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileEdit,
  FlaskConical,
  HelpCircle,
  Loader,
  PenLine,
  RotateCcw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { StatusMeta, Tone } from "@/lib/labels";

const E = (label: string, tone: Tone, icon: LucideIcon, description: string): StatusMeta => ({ label, tone, icon, description });

/** Estados emitidos pela fila editorial V2 (8zHUZGYSA0nPhMWI). */
export const ESTADO_FILA: Record<string, StatusMeta> = {
  aguardando_pauta: E("Aguardando pauta", "neutral", CircleDashed, "A pauta ainda não foi aprovada."),
  aguardando_briefing: E("Aguardando briefing", "neutral", Clock3, "Aguardando a etapa do Pesquisador."),
  aguardando_redacao: E("Aguardando redação", "neutral", Clock3, "Aguardando a etapa do Redator."),
  aguardando_revisao: E("Aguardando revisão do agente", "neutral", Clock3, "Aguardando a etapa do Revisor (agente)."),
  executando: E("Em execução", "info", Loader, "Uma etapa de agente está reservada ou em execução."),
  aguardando_editor: E("Aguardando editor", "info", FileEdit, "Pronto para a revisão editorial humana."),
  pendente_ajustes: E("Pendente de ajustes", "warning", TriangleAlert, "Há pendências do Revisor que exigem avaliação explícita."),
  aprovado_editorial: E("Aprovado (editorial)", "success", CheckCircle2, "Aprovação editorial registrada para a versão atual."),
  aprovacao_simulada: E("Aprovação simulada (teste)", "brand", FlaskConical, "Decisão de teste; não vale como aprovação."),
  devolvido: E("Devolvido", "warning", RotateCcw, "Devolvido pelo editor com motivos."),
  resultado_incerto: E("Resultado incerto", "danger", AlertOctagon, "Uma etapa falhou com resultado incerto; conferir antes de repetir."),
  bloqueado_integridade: E("Bloqueado por integridade", "danger", AlertOctagon, "O resultado de uma etapa não passou na conferência."),
};

export function estadoMeta(estado: string): StatusMeta {
  return ESTADO_FILA[estado] ?? E(estado.replace(/_/g, " "), "neutral", HelpCircle, "Estado não mapeado no painel.");
}

export const ORIGEM_VERSAO: Record<string, string> = {
  redator: "Agente Redator",
  revisor: "Agente Revisor",
  importacao_documentada: "Importação documentada",
};

export function origemVersao(origem: string): string {
  if (origem.startsWith("edicao_humana:")) return `Edição humana (${origem.slice("edicao_humana:".length)})`;
  return ORIGEM_VERSAO[origem] ?? origem;
}

export const EDIT_ICON = PenLine;

export const EVENTO_HISTORICO: Record<string, string> = {
  pauta_enfileirada: "Pauta enfileirada",
  pauta_aprovada: "Pauta aprovada",
  etapa_reservada: "Etapa reservada",
  etapa_concluida: "Etapa concluída",
  correcao_autorizada: "Correção autorizada",
  falha_com_resultado_incerto: "Falha com resultado incerto",
  resultado_preservado_com_bloqueio: "Resultado preservado com bloqueio",
  pendencias_importadas_explicitadas: "Pendências importadas e explicitadas",
};
