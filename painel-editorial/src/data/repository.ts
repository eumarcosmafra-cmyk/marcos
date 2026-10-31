/**
 * Contrato da camada de acesso a dados.
 *
 * Os componentes visuais dependem SOMENTE desta interface. Hoje a implementação é
 * `LocalEditorialRepository` (navegador). Na integração, uma `ApiEditorialRepository`
 * implementará o mesmo contrato chamando rotas de servidor — ver INTEGRACAO_FUTURA.md.
 */
import type { EditorialCommand } from "@/domain/commands";
import type { Project, ProjectWorkspace, ReviewerIdentity } from "@/domain/types";

export type RepositoryMode = "demonstracao_local" | "api";

export interface CommandOutcome {
  ok: boolean;
  message: string;
  createdId?: string;
}

export interface DemoSettings {
  reviewers: ReviewerIdentity[];
  activeReviewerId: string;
}

export interface EditorialRepository {
  readonly mode: RepositoryMode;
  listProjects(): Promise<Project[]>;
  getWorkspace(projectId: string): Promise<ProjectWorkspace | null>;
  execute(projectId: string, command: EditorialCommand, actor: ReviewerIdentity): Promise<CommandOutcome>;
  /** Identidades locais (somente demonstração). Em produção vêm da autenticação. */
  getDemoSettings(): Promise<DemoSettings>;
  saveDemoSettings(settings: DemoSettings): Promise<void>;
  /** Restaura os dados de demonstração (somente modo local). */
  resetDemo(): Promise<void>;
  /** Avisa quando outra aba alterar os dados. Retorna função para cancelar. */
  subscribe(listener: (projectId: string | null) => void): () => void;
}

/** Rascunhos não salvos ficam fora do agregado: nunca viram versão sozinhos. */
export interface DraftStore {
  get(projectId: string, articleId: string): { baseVersionId: string; markdown: string; savedAt: string } | null;
  set(projectId: string, articleId: string, draft: { baseVersionId: string; markdown: string }): void;
  clear(projectId: string, articleId: string): void;
}
