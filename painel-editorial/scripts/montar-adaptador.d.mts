export const CODIGO: {
  validar: string;
  leitura: string;
  encaminhar: string;
  respostaFila: string;
  erroFila: string;
  encaminharProdutor: string;
  respostaProdutor: string;
  repassarProdutor: string;
  pautas: string;
  encaminharFontes: string;
  aceiteFontes: string;
  repassarFontes: string;
  encaminharAprovacao: string;
  encaminharEnfileirador: string;
};
export const IDS: { workflowFila: string; workflowProdutor: string; workflowFontes: string; workflowEnfileirador: string; tabelaContexto: string; tabelaFila: string; webhookId: string; path: string; credencialNome: string };
export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  onError?: string;
}
export function montarWorkflow(credencialId?: string): {
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
  settings: Record<string, unknown>;
};
