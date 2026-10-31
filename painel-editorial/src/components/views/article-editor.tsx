"use client";

import clsx from "clsx";
import { Check, Columns2, Copy, Download, Eye, FilePlus2, Pencil, RotateCcw, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ArticleState } from "@/domain/rules";
import { countWords } from "@/domain/rules";
import type { Article, ProjectWorkspace } from "@/domain/types";
import type { DraftStore } from "@/data/repository";
import { formatDateTime, slugify } from "@/lib/format";
import type { WorkspaceHandle } from "@/state/editorial";
import { useToast } from "@/state/toast";
import { useUnsavedGuard } from "@/state/unsaved-guard";
import { MarkdownView } from "@/components/markdown-view";
import { Dialog, EmptyState, Notice, PendingIntegrationTag } from "@/components/ui";

type Mode = "previa" | "editar" | "lado";

export function ArticleEditor({
  ws,
  article,
  state,
  drafts,
  execute,
  onDirtyChange,
}: {
  ws: ProjectWorkspace;
  article: Article;
  state: ArticleState;
  drafts: DraftStore | null;
  execute: WorkspaceHandle["execute"];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const current = state.current;
  const toast = useToast();
  const { setDirty } = useUnsavedGuard();
  const guardKey = `artigo-${article.id}`;
  const [mode, setMode] = useState<Mode>("previa");
  const [text, setText] = useState(current?.markdown ?? "");
  const [staleDraft, setStaleDraft] = useState<{ markdown: string; savedAt: string; baseVersionId: string } | null>(null);
  const [recoveredAt, setRecoveredAt] = useState<string>();
  const [saveOpen, setSaveOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const loadedFor = useRef<string | undefined>(undefined);

  // Carrega a versão atual (ou um rascunho local compatível) sempre que a versão muda.
  useEffect(() => {
    if (!current || loadedFor.current === current.id) return;
    loadedFor.current = current.id;
    const draft = drafts?.get(ws.project.id, article.id) ?? null;
    if (draft && draft.markdown !== current.markdown) {
      if (draft.baseVersionId === current.id) {
        setText(draft.markdown);
        setRecoveredAt(draft.savedAt);
        setStaleDraft(null);
        setMode("editar");
        return;
      }
      setStaleDraft(draft);
    } else {
      setStaleDraft(null);
    }
    setRecoveredAt(undefined);
    setText(current.markdown);
  }, [current, drafts, ws.project.id, article.id]);

  const dirty = Boolean(current) && text !== current?.markdown;

  useEffect(() => {
    setDirty(guardKey, dirty);
    onDirtyChange(dirty);
  }, [dirty, guardKey, setDirty, onDirtyChange]);

  useEffect(() => () => setDirty(guardKey, false), [guardKey, setDirty]);

  // Guarda o rascunho não salvo neste navegador (não vira versão sozinho).
  useEffect(() => {
    if (!current || !drafts) return;
    const t = window.setTimeout(() => {
      try {
        if (dirty) drafts.set(ws.project.id, article.id, { baseVersionId: current.id, markdown: text });
        else if (!staleDraft) drafts.clear(ws.project.id, article.id);
      } catch (e) {
        console.error("[article-editor] Erro ao guardar rascunho local:", e);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [text, dirty, current, drafts, ws.project.id, article.id, staleDraft]);

  if (!current) {
    return (
      <EmptyState
        title="Ainda não existe versão deste artigo"
        icon={FilePlus2}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={() => void execute({ type: "article.startManualDraft", articleId: article.id })}>
              Iniciar rascunho manual
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              Solicitar redação ao agente Redator <PendingIntegrationTag />
            </span>
          </div>
        }
      >
        A pauta foi aprovada e o artigo está em rascunho. O texto pode ser iniciado manualmente a partir da estrutura sugerida; a versão criada entra em revisão editorial.
      </EmptyState>
    );
  }

  const discard = () => {
    if (!window.confirm("Descartar as alterações não salvas e voltar ao texto da versão atual?")) return;
    setText(current.markdown);
    setRecoveredAt(undefined);
    try {
      drafts?.clear(ws.project.id, article.id);
    } catch (e) {
      console.error("[article-editor] Erro ao descartar rascunho:", e);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[article-editor] Erro ao copiar:", e);
      toast.show({ tone: "danger", message: "O navegador não permitiu copiar. Use Baixar .md." });
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(article.title) || "artigo"}-v${current.number}${dirty ? "-alteracoes-nao-salvas" : ""}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    setSaving(true);
    const r = await execute({ type: "article.saveVersion", articleId: article.id, baseVersionId: current.id, markdown: text, changeNote });
    setSaving(false);
    if (r.ok) {
      setSaveOpen(false);
      setChangeNote("");
      setRecoveredAt(undefined);
      try {
        drafts?.clear(ws.project.id, article.id);
      } catch (e) {
        console.error("[article-editor] Erro ao limpar rascunho:", e);
      }
      setMode("previa");
    }
  };

  const hasApprovalOnCurrent = Boolean(state.editorialApproval || state.specialistReview || state.finalApproval);

  return (
    <div className="flex flex-col gap-3">
      {recoveredAt ? (
        <Notice tone="info" icon={RotateCcw}>
          Alterações não salvas recuperadas deste navegador ({formatDateTime(recoveredAt)}). Elas ainda não são uma versão.
        </Notice>
      ) : null}
      {staleDraft ? (
        <Notice tone="warning" icon={RotateCcw} title="Há um rascunho local baseado em outra versão">
          <p>O rascunho guardado em {formatDateTime(staleDraft.savedAt)} partiu de uma versão anterior à v{current.number}. Ele não foi carregado para não sobrescrever o texto atual.</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setText(staleDraft.markdown);
                setStaleDraft(null);
                setMode("lado");
              }}
            >
              Carregar mesmo assim
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                drafts?.clear(ws.project.id, article.id);
                setStaleDraft(null);
              }}
            >
              Descartar rascunho
            </button>
          </div>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5">
        <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Modo do editor">
          {([
            ["previa", "Prévia", Eye],
            ["editar", "Editar Markdown", Pencil],
            ["lado", "Lado a lado", Columns2],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => setMode(k)}
              className={clsx(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                k === "lado" && "hidden lg:inline-flex",
                mode === k ? "bg-brand-700 text-white" : "text-muted hover:bg-subtle",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted tabular-nums">{countWords(text).toLocaleString("pt-BR")} palavras</span>
        {dirty ? (
          <span className="chip border-amber-300 bg-amber-50 text-amber-950" role="status">
            <Pencil className="h-3 w-3" aria-hidden /> Alterações não salvas
          </span>
        ) : (
          <span className="text-xs text-faint">Texto da v{current.number}</span>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" className="btn-ghost btn-sm" onClick={() => void copy()}>
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copiado" : "Copiar Markdown"}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={download}>
            <Download className="h-3.5 w-3.5" aria-hidden /> Baixar .md
          </button>
          {dirty ? (
            <button type="button" className="btn-ghost btn-sm" onClick={discard}>
              Descartar
            </button>
          ) : null}
          <button type="button" className="btn-primary btn-sm" disabled={!dirty} onClick={() => setSaveOpen(true)}>
            <Save className="h-3.5 w-3.5" aria-hidden /> Salvar nova versão
          </button>
        </div>
      </div>

      <div className={clsx(mode === "lado" && "lg:grid lg:grid-cols-2 lg:gap-4")}>
        {mode !== "previa" ? (
          <div>
            <label htmlFor={`md-${article.id}`} className="sr-only">Markdown do artigo</label>
            <textarea
              id={`md-${article.id}`}
              className="textarea min-h-[60vh] resize-y bg-surface"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck
              lang="pt-BR"
            />
          </div>
        ) : null}
        {mode !== "editar" ? (
          <div className={clsx("card px-4 py-5 sm:px-8 sm:py-7", mode === "lado" && "mt-4 lg:mt-0 lg:max-h-[75vh] lg:overflow-y-auto")}>
            {dirty ? <p className="mb-3 font-sans text-xs font-medium text-amber-800">Prévia com alterações não salvas</p> : null}
            <MarkdownView markdown={text} baseUrl={ws.project.siteUrl} />
          </div>
        ) : null}
      </div>

      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={`Salvar como v${Math.max(...article.versions.map((v) => v.number)) + 1}`}
        description={
          hasApprovalOnCurrent
            ? `A v${current.number} tem decisões registradas. A nova versão volta para revisão editorial; as decisões da v${current.number} permanecem somente no histórico.`
            : `A v${current.number} será preservada no histórico.`
        }
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSaveOpen(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>Salvar nova versão</button>
          </>
        }
      >
        <label htmlFor="change-note" className="field-label">O que mudou (opcional)</label>
        <textarea id="change-note" className="input" rows={3} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Ex.: dividi o parágrafo da seção Base e deslocamento" />
      </Dialog>
    </div>
  );
}
