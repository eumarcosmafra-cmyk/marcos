import { PainelError } from "../painel-error";

/**
 * Tradução dos códigos devolvidos pela fila/adaptador para mensagens do painel.
 * O código original é preservado em `detalhe.codigo_fila` para diagnóstico.
 */
const MAPA: Record<string, { code: string; status: number; mensagem: string }> = {
  controle_ocupado_ou_indisponivel: { code: "FILA_OCUPADA", status: 503, mensagem: "A fila está ocupada por outra operação. Nada foi alterado; tente novamente em instantes." },
  liberacao_nao_confirmada: { code: "FILA_LIBERACAO_INCERTA", status: 502, mensagem: "A operação rodou, mas a fila não confirmou a liberação da trava. Recarregue antes de agir de novo." },
  conflito_de_versao: { code: "VERSAO_DESATUALIZADA", status: 409, mensagem: "O trabalho mudou desde que foi aberto (outra revisão foi gravada). Recarregue para ver a versão atual." },
  artigo_de_outra_versao: { code: "VERSAO_DESATUALIZADA", status: 409, mensagem: "O texto exibido não é mais a versão atual do artigo. Recarregue." },
  edicao_de_outra_versao: { code: "VERSAO_DESATUALIZADA", status: 409, mensagem: "A edição partiu de uma versão antiga ou há etapa em execução. Recarregue." },
  conflito_ou_falha_de_gravacao: { code: "GRAVACAO_NAO_CONFIRMADA", status: 409, mensagem: "A gravação não foi confirmada (conflito). Recarregue e confira o estado antes de repetir." },
  trabalho_alterado: { code: "INTEGRIDADE_DIVERGENTE", status: 409, mensagem: "O registro não passou na conferência de integridade da fila." },
  pendencias_exigem_decisao_explicita: { code: "PENDENCIAS_SEM_AVALIACAO", status: 422, mensagem: "A aprovação exige avaliar as pendências exibidas e escrever uma justificativa (mín. 20 caracteres). Se a lista mudou, recarregue." },
  decisao_sem_artigo_ou_confirmacao: { code: "DECISAO_INCOMPLETA", status: 422, mensagem: "Decisão sem confirmação de revisão, sem artigo completo ou com etapa em execução." },
  estado_nao_revisavel: { code: "ESTADO_NAO_REVISAVEL", status: 422, mensagem: "O estado atual do trabalho não aceita decisão editorial." },
  ajustes_pendentes: { code: "APROVACAO_BLOQUEADA", status: 422, mensagem: "O estado atual não aceita aprovação (ex.: já devolvido ou aprovado). Salve uma nova versão para reabrir a revisão." },
  devolucao_sem_motivos: { code: "MOTIVOS_OBRIGATORIOS", status: 422, mensagem: "A devolução exige ao menos um motivo." },
  motivos_invalidos: { code: "MOTIVOS_INVALIDOS", status: 422, mensagem: "Motivos inválidos (mínimo de 5 caracteres cada, até 20 motivos)." },
  editor_nao_autorizado: { code: "NAO_AUTORIZADO", status: 403, mensagem: "O cadastro do cliente não autoriza este editor." },
  trabalho_nao_encontrado: { code: "TRABALHO_NAO_ENCONTRADO", status: 404, mensagem: "Trabalho não encontrado neste cliente e ambiente." },
  id_reutilizado_com_outro_pedido: { code: "OPERACAO_REPETIDA", status: 409, mensagem: "Esta tentativa já foi registrada com outro conteúdo. Recarregue e repita a ação." },
  artigo_ausente_ou_excessivo: { code: "ARTIGO_INVALIDO", status: 422, mensagem: "O artigo precisa ter entre 200 e 800000 caracteres." },
  cadastro_ausente_ou_ambiguo: { code: "CADASTRO_CLIENTE", status: 502, mensagem: "O cadastro do cliente na fila está ausente ou ambíguo." },
  operacao_nao_permitida: { code: "OPERACAO_NAO_PERMITIDA", status: 400, mensagem: "Operação não liberada pelo adaptador." },
  campo_nao_permitido: { code: "PEDIDO_RECUSADO", status: 400, mensagem: "O adaptador recusou campos do pedido." },
};

export function mapQueueError(codigo: string, mensagem: string): PainelError {
  const m = MAPA[codigo];
  if (m) return new PainelError(m.code, m.mensagem, m.status, { codigo_fila: codigo });
  const safe = /^[a-z0-9_]{2,80}$/.test(codigo) ? codigo : "erro_desconhecido";
  return new PainelError("FILA_RECUSOU", mensagem ? `A fila recusou a operação: ${mensagem.slice(0, 300)}` : "A fila recusou a operação.", 422, { codigo_fila: safe });
}
