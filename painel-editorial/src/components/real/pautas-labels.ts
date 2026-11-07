import { CheckCircle2, CircleDashed, FileSearch, TriangleAlert, type LucideIcon } from "lucide-react";
import type { StatusMeta, Tone } from "@/lib/labels";
import type { EstadoFontes, PautaDTO } from "@/lib/pautas-types";

const E = (label: string, tone: Tone, icon: LucideIcon, description: string): StatusMeta => ({ label, tone, icon, description });

export const ESTADO_FONTES: Record<EstadoFontes, StatusMeta> = {
  nenhuma: E("Sem fontes", "neutral", CircleDashed, "Ainda não houve busca de fontes para esta pauta."),
  proposta: E("Fontes propostas", "info", FileSearch, "Há 3 fontes propostas aguardando a sua aprovação."),
  insuficiente: E("Fontes insuficientes", "warning", TriangleAlert, "A busca não achou 3 fontes utilizáveis; informe URLs ou busque de novo."),
  aprovada: E("Fontes aprovadas", "success", CheckCircle2, "Fontes aprovadas; a pauta pode ir para produção."),
};

export const MOTIVO_CANDIDATO: Record<string, string> = {
  coleta_falhou: "a página não pôde ser coletada",
  pagina_sem_texto: "página sem texto suficiente",
  endereco_final_invalido: "endereço final inválido",
  dominio_excluido: "rede social, fórum ou loja",
  site_do_cliente: "é o próprio site do cliente",
  repetida: "mesma página de outro resultado",
  endereco_instavel: "o endereço muda a cada coleta",
  sem_trecho_util: "nenhuma seção relevante com tamanho utilizável",
  mesmo_dominio_ou_excedente: "reserva (mesmo domínio ou excedente)",
  coleta_desalinhada: "falha interna na coleta",
  redirecionamento_google_nao_resolvido: "link do Google sem destino resolvido",
  pagina_de_loja: "página de loja (muitos preços)",
};

export const SITUACAO_CANDIDATO: Record<string, string> = { escolhida: "Escolhida", apta: "Apta", reserva: "Reserva", descartada: "Descartada", coletada: "Coletada" };

export type FiltroPauta = "todas" | "sem_fontes" | "propostas" | "prontas" | "na_fila";

export function filtroDaPauta(p: PautaDTO): Exclude<FiltroPauta, "todas"> {
  if (p.trabalhos.length) return "na_fila";
  if (p.fontes.estado === "aprovada") return "prontas";
  if (p.fontes.estado === "proposta") return "propostas";
  return "sem_fontes";
}
