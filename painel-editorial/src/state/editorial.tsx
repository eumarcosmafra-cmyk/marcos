"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EditorialCommand } from "@/domain/commands";
import type { Project, ProjectWorkspace, ReviewerIdentity } from "@/domain/types";
import {
  browserStorage,
  LocalDraftStore,
  LocalEditorialRepository,
  StorageCorruptedError,
} from "@/data/local-repository";
import type { CommandOutcome, DemoSettings, DraftStore, EditorialRepository } from "@/data/repository";
import { useToast } from "./toast";

type LoadStatus = "loading" | "ready" | "error";

interface EditorialContextValue {
  repo: EditorialRepository | null;
  drafts: DraftStore | null;
  status: LoadStatus;
  error?: string;
  projects: Project[];
  settings: DemoSettings | null;
  activeReviewer: ReviewerIdentity | null;
  setActiveReviewer: (id: string) => Promise<void>;
  saveSettings: (s: DemoSettings) => Promise<void>;
  resetDemo: () => Promise<void>;
  hardReset: () => void;
  /** Incrementa sempre que algum dado muda (nesta ou em outra aba). */
  revision: number;
}

const EditorialContext = createContext<EditorialContextValue | null>(null);

function describeError(e: unknown): string {
  if (e instanceof StorageCorruptedError) return e.message;
  if (e instanceof DOMException && e.name === "SecurityError") {
    return "O navegador bloqueou o armazenamento local. Libere o armazenamento do site ou saia do modo de navegação restrita.";
  }
  if (e instanceof DOMException && e.name === "QuotaExceededError") {
    return "O armazenamento local do navegador está cheio.";
  }
  return "Não foi possível ler os dados locais.";
}

export function EditorialProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<EditorialRepository | null>(null);
  const [drafts, setDrafts] = useState<DraftStore | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (r: EditorialRepository) => {
    try {
      const [p, s] = await Promise.all([r.listProjects(), r.getDemoSettings()]);
      setProjects(p);
      setSettings(s);
      setStatus("ready");
      setError(undefined);
    } catch (e) {
      console.error("[editorial] Erro ao carregar:", e);
      setError(describeError(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    try {
      const storage = browserStorage();
      const r = new LocalEditorialRepository(storage);
      setRepo(r);
      setDrafts(new LocalDraftStore(storage));
      void load(r);
      const unsub = r.subscribe(() => {
        setRevision((n) => n + 1);
        void load(r);
      });
      return unsub;
    } catch (e) {
      console.error("[editorial] Armazenamento indisponível:", e);
      setError(describeError(e));
      setStatus("error");
    }
  }, [load]);

  const activeReviewer = useMemo(() => {
    if (!settings) return null;
    return settings.reviewers.find((r) => r.id === settings.activeReviewerId) ?? settings.reviewers[0] ?? null;
  }, [settings]);

  const saveSettings = useCallback(
    async (s: DemoSettings) => {
      if (!repo) return;
      await repo.saveDemoSettings(s);
      setSettings(s);
    },
    [repo],
  );

  const setActiveReviewer = useCallback(
    async (id: string) => {
      if (!settings) return;
      await saveSettings({ ...settings, activeReviewerId: id });
    },
    [saveSettings, settings],
  );

  const resetDemo = useCallback(async () => {
    if (!repo) return;
    await repo.resetDemo();
    await load(repo);
    setRevision((n) => n + 1);
  }, [repo, load]);

  const hardReset = useCallback(() => {
    try {
      LocalEditorialRepository.hardReset(browserStorage());
      window.location.reload();
    } catch (e) {
      console.error("[editorial] Falha ao limpar dados locais:", e);
      setError(describeError(e));
    }
  }, []);

  const value: EditorialContextValue = {
    repo,
    drafts,
    status,
    error,
    projects,
    settings,
    activeReviewer,
    setActiveReviewer,
    saveSettings,
    resetDemo,
    hardReset,
    revision,
  };

  return <EditorialContext.Provider value={value}>{children}</EditorialContext.Provider>;
}

export function useEditorial(): EditorialContextValue {
  const ctx = useContext(EditorialContext);
  if (!ctx) throw new Error("useEditorial fora do EditorialProvider");
  return ctx;
}

export interface WorkspaceHandle {
  status: LoadStatus | "not_found";
  ws: ProjectWorkspace | null;
  error?: string;
  reload: () => Promise<void>;
  execute: (cmd: EditorialCommand, opts?: { silent?: boolean; actorId?: string }) => Promise<CommandOutcome>;
}

export function useWorkspace(projectId: string | undefined): WorkspaceHandle {
  const { repo, activeReviewer, settings, revision, status: rootStatus, error: rootError } = useEditorial();
  const toast = useToast();
  const [ws, setWs] = useState<ProjectWorkspace | null>(null);
  const [status, setStatus] = useState<WorkspaceHandle["status"]>("loading");
  const [error, setError] = useState<string>();
  const projectRef = useRef(projectId);
  projectRef.current = projectId;

  const reload = useCallback(async () => {
    if (!repo || !projectId) return;
    try {
      const data = await repo.getWorkspace(projectId);
      if (projectRef.current !== projectId) return;
      setWs(data);
      setStatus(data ? "ready" : "not_found");
      setError(undefined);
    } catch (e) {
      console.error("[editorial] Erro ao carregar projeto:", e);
      setError(describeError(e));
      setStatus("error");
    }
  }, [repo, projectId]);

  useEffect(() => {
    setStatus("loading");
    void reload();
  }, [reload, revision]);

  const execute = useCallback(
    async (cmd: EditorialCommand, opts?: { silent?: boolean; actorId?: string }): Promise<CommandOutcome> => {
      const actor = opts?.actorId ? settings?.reviewers.find((r) => r.id === opts.actorId) : activeReviewer;
      if (!repo || !projectId || !actor) {
        const outcome = { ok: false, message: "Dados ainda não carregados." };
        toast.show({ tone: "danger", message: outcome.message });
        return outcome;
      }
      try {
        const outcome = await repo.execute(projectId, cmd, actor);
        if (!opts?.silent || !outcome.ok) toast.show({ tone: outcome.ok ? "success" : "danger", message: outcome.message });
        if (outcome.ok) await reload();
        return outcome;
      } catch (e) {
        console.error("[editorial] Erro ao executar comando:", cmd.type, e);
        const message = `Não foi possível salvar: ${describeError(e)}`;
        toast.show({ tone: "danger", message });
        return { ok: false, message };
      }
    },
    [repo, projectId, activeReviewer, settings, reload, toast],
  );

  if (rootStatus === "error") return { status: "error", ws: null, error: rootError, reload, execute };
  return { status: rootStatus === "loading" ? "loading" : status, ws, error, reload, execute };
}
