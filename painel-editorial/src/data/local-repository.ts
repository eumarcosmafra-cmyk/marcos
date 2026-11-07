/**
 * Implementação local (modo demonstração).
 *
 * Persistência no `localStorage`, com UMA chave por projeto — os dados de um
 * cliente nunca são gravados junto com os de outro. Nenhuma credencial, token
 * ou chave de serviço é armazenada aqui.
 */
import { applyCommand, type EditorialCommand } from "@/domain/commands";
import type { Project, ProjectWorkspace, ReviewerIdentity } from "@/domain/types";
import { buildSeedWorkspaces, DEMO_REVIEWERS } from "./seed";
import type { CommandOutcome, DemoSettings, DraftStore, EditorialRepository } from "./repository";

export const STORAGE_PREFIX = "mafra-editorial:v1";
const KEY_INDEX = `${STORAGE_PREFIX}:projetos`;
const KEY_DEMO = `${STORAGE_PREFIX}:demo`;
const projectKey = (id: string) => `${STORAGE_PREFIX}:projeto:${id}`;
const draftKey = (projectId: string, articleId: string) => `${STORAGE_PREFIX}:rascunho:${projectId}:${articleId}`;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function browserStorage(): KeyValueStorage {
  const ls = window.localStorage;
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
    keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => Boolean(k)),
  };
}

export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    keys: () => Array.from(map.keys()),
  };
}

export class StorageCorruptedError extends Error {
  constructor(key: string) {
    super(`Os dados locais em “${key}” estão ilegíveis.`);
    this.name = "StorageCorruptedError";
  }
}

function parse<T>(raw: string | null, key: string): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("[local-repository] Erro ao ler", key, e);
    throw new StorageCorruptedError(key);
  }
}

function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export class LocalEditorialRepository implements EditorialRepository {
  readonly mode = "demonstracao_local" as const;
  private listeners = new Set<(projectId: string | null) => void>();

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  private ensureSeeded(): void {
    if (this.storage.getItem(KEY_INDEX) !== null) return;
    const seeds = buildSeedWorkspaces();
    for (const ws of seeds) this.storage.setItem(projectKey(ws.project.id), JSON.stringify(ws));
    this.storage.setItem(KEY_INDEX, JSON.stringify(seeds.map((s) => s.project.id)));
  }

  private readIndex(): string[] {
    this.ensureSeeded();
    return parse<string[]>(this.storage.getItem(KEY_INDEX), KEY_INDEX) ?? [];
  }

  private read(projectId: string): ProjectWorkspace | null {
    this.ensureSeeded();
    const key = projectKey(projectId);
    const ws = parse<ProjectWorkspace>(this.storage.getItem(key), key);
    if (ws && ws.project.id !== projectId) {
      // Defesa extra contra mistura de dados entre projetos.
      console.error("[local-repository] Projeto divergente na chave", key);
      throw new StorageCorruptedError(key);
    }
    return ws;
  }

  private write(ws: ProjectWorkspace): void {
    this.storage.setItem(projectKey(ws.project.id), JSON.stringify(ws));
  }

  async listProjects(): Promise<Project[]> {
    return this.readIndex()
      .map((id) => this.read(id))
      .filter((ws): ws is ProjectWorkspace => ws !== null)
      .map((ws) => ws.project);
  }

  async getWorkspace(projectId: string): Promise<ProjectWorkspace | null> {
    return this.read(projectId);
  }

  async execute(projectId: string, command: EditorialCommand, actor: ReviewerIdentity): Promise<CommandOutcome> {
    const ws = this.read(projectId);
    if (!ws) return { ok: false, message: "Projeto não encontrado." };
    const result = applyCommand(ws, command, { now: this.clock, newId, actor });
    if (!result.ok) return { ok: false, message: result.error };
    this.write(result.workspace);
    this.emit(projectId);
    return { ok: true, message: result.message, createdId: result.createdId };
  }

  async getDemoSettings(): Promise<DemoSettings> {
    const saved = parse<DemoSettings>(this.storage.getItem(KEY_DEMO), KEY_DEMO);
    if (saved && saved.reviewers.length > 0) return saved;
    return { reviewers: DEMO_REVIEWERS, activeReviewerId: DEMO_REVIEWERS[0].id };
  }

  async saveDemoSettings(settings: DemoSettings): Promise<void> {
    this.storage.setItem(KEY_DEMO, JSON.stringify(settings));
    this.emit(null);
  }

  async resetDemo(): Promise<void> {
    for (const k of this.storage.keys()) if (k.startsWith(STORAGE_PREFIX)) this.storage.removeItem(k);
    this.ensureSeeded();
    this.emit(null);
  }

  /** Usado pela interface quando os dados locais estão ilegíveis. */
  static hardReset(storage: KeyValueStorage): void {
    for (const k of storage.keys()) if (k.startsWith(STORAGE_PREFIX)) storage.removeItem(k);
  }

  subscribe(listener: (projectId: string | null) => void): () => void {
    this.listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
      const m = /:projeto:(.+)$/.exec(e.key);
      listener(m ? m[1] : null);
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  private emit(projectId: string | null): void {
    for (const l of this.listeners) l(projectId);
  }
}

export class LocalDraftStore implements DraftStore {
  constructor(private readonly storage: KeyValueStorage) {}

  get(projectId: string, articleId: string) {
    try {
      return parse<{ baseVersionId: string; markdown: string; savedAt: string }>(
        this.storage.getItem(draftKey(projectId, articleId)),
        draftKey(projectId, articleId),
      );
    } catch (e) {
      console.error("[local-repository] Rascunho ilegível descartado:", e);
      this.storage.removeItem(draftKey(projectId, articleId));
      return null;
    }
  }

  set(projectId: string, articleId: string, draft: { baseVersionId: string; markdown: string }) {
    this.storage.setItem(draftKey(projectId, articleId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
  }

  clear(projectId: string, articleId: string) {
    this.storage.removeItem(draftKey(projectId, articleId));
  }
}
