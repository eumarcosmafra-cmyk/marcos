import type { WorkflowNode } from "./montar-adaptador.mjs";
export const CODIGO_FONTES: Record<
  | "validar"
  | "conferirPlano"
  | "prepararCandidatos"
  | "resolverDestinos"
  | "recortar"
  | "juntarModelo"
  | "montarProposta"
  | "conferirProposta"
  | "entregarProposta"
  | "entregarAprovacao"
  | "recusa",
  string
>;
export const IDS_FONTES: { workflow: string; tabela: string; credCrawl: { id: string; name: string }; credDeepseek: { id: string; name: string } };
export function montarWorkflowFontes(): {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: Record<string, { main: { node: string; type: string; index: number }[][] }>;
  settings: Record<string, unknown>;
};
