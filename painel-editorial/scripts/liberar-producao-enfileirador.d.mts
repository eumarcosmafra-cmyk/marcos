export const TROCAS: { nome: string; antes: string; depois: string; esperado: number }[];
export function liberarProducao(entrada: unknown): { wf: { id?: string; nodes: { name: string; parameters: { jsCode?: string } }[] }; contagem: Record<string, number> };
