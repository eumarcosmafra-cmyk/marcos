"use client";

import clsx from "clsx";
import { Columns2, Copy, Download, Eye, Pencil, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ambiente, TrabalhoDTO } from "@/lib/fila-types";
import { countWords } from "@/domain/rules";
import { formatDateTime, slugify } from "@/lib/format";
import { useToast } from "@/state/toast";
import { useUnsavedGuard } from "@/state/unsaved-guard";
import { MarkdownView } from "@/components/markdown-view";
import { Dialog, Notice } from "@/components/ui";
import { api, ApiError, novoOpUuid } from "./api";
import { ActionError } from "./load-state";

type Modo = "leitura" | "edicao" | "lado";

interface Rascunho {
  base_sha: string;
  base_revisao: number;
  markdown: string;
  salvo_em: string;
}

const chaveRascunho = (ambiente: Ambiente, jobKey: string) => `painel-real:rascunho:${ambiente}:${jobKey}`;

function lerRascunho(chave: string): Rascunho | null {
  try {
    const raw = window.localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as Rascunho) : null;
  } catch (e) {
    console.error("[editor] Rascunho local ilegível:", e);
    return null;
  }
}

export function EditorReal({
  trabalho,
  ambiente,
  modoInicial = "leitura",
  onSaved,
}: {
  trabalho: TrabalhoDTO;
  ambiente: Ambiente;
  modoInicial?: Modo;
  onSaved: (mensagem: string) => void;
}) {
  const atual = trabalho.artigo_markdown ?? "";
  const chave = chaveRascunho(ambiente, trabalho.job_key);
  const toast = useToast();
  const { setDirty } = useUnsavedGuard();
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [texto, setTexto] = useState(atual);
  const [rascunhoAntigo, setRascunhoAntigo] = useState<Rascunho | null>(null);
  const [salvarAberto, setSalvarAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState<{ uuid: string; chave: string; incerta: boolean } | null>(null);

  // Recupera rascunho local (só se partiu da mesma versão atual).
  useEffect(() => {
    const r = lerRascunho(chave);
    if (r && r.markdown !== atual) {
      if (r.base_sha === trabalho.artigo_sha256) {
        setTexto(r.markdown);
        setModo("edicao");
      } else setRascunhoAntigo(r);
    } else setTexto(atual);
  }, [chave, atual, trabalho.artigo_sha256]);

  const sujo = texto !== atual;
  useEffect(() => {
    setDirty(`real-${trabalho.job_key}`, sujo);
    return () => setDirty(`real-${trabalho.job_key}`, false);
  }, [sujo, setDirty, trabalho.job_key]);

  // Guarda o rascunho local (não vira versão sozinho). Grava com pequeno atraso e
  // também ao sair da página, para não perder o que foi digitado por último.
  const pendente = useRef<() => void>(() => {});
  useEffect(() => {
    const gravar = () => {
      try {
        if (sujo) {
          const r: Rascunho = { base_sha: trabalho.artigo_sha256 ?? "", base_revisao: trabalho.revisao, markdown: texto, salvo_em: new Date().toISOString() };
          window.localStorage.setItem(chave, JSON.stringify(r));
        } else if (!rascunhoAntigo) window.localStorage.removeItem(chave);
      } catch (e) {
        console.error("[editor] Não foi possível guardar o rascunho local:", e);
      }
    };
    pendente.current = gravar;
    const t = window.setTimeout(gravar, 150);
    return () => window.clearTimeout(t);
  }, [texto, sujo, chave, trabalho.artigo_sha256, trabalho.revisao, rascunhoAntigo]);
  useEffect(() => {
    const flush = () => pendente.current();
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  const palavras = useMemo(() => countWords(texto), [texto]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.show({ tone: "success", message: "Markdown copiado." });
    } catch (e) {
      console.error("[editor] Falha ao copiar:", e);
      toast.show({ tone: "danger", message: "O navegador não permitiu copiar. Use Baixar .md." });
    }
  };

  const baixar = () => {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(trabalho.titulo_artigo ?? trabalho.keyword) || "artigo"}-v${trabalho.versao_artigo}${sujo ? "-alteracoes-nao-salvas" : ""}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const salvar = async () => {
    const corpo = { revisao_esperada: trabalho.revisao, artigo_sha256: trabalho.artigo_sha256, markdown: texto };
    const chaveTentativa = JSON.stringify(corpo);
    const uuid = tentativa && tentativa.chave === chaveTentativa && tentativa.incerta ? tentativa.uuid : novoOpUuid();
    setTentativa({ uuid, chave: chaveTentativa, incerta: false });
    setEnviando(true);
    setErro(null);
    try {
      const r = await api<{ revisao: number; versao_artigo: number; resultado_reutilizado: boolean }>(
        `/api/fila/${trabalho.job_key}/edicao?ambiente=${ambiente}`,
        { method: "POST", body: { ...corpo, op_uuid: uuid } },
      );
      setTentativa(null);
      setDirty(`real-${trabalho.job_key}`, false);
      try {
        window.localStorage.removeItem(chave);
      } catch (e) {
        console.error("[editor] Falha ao limpar rascunho local:", e);
      }
      setSalvarAberto(false);
      onSaved(`Versão v${r.versao_artigo} criada (revisão ${r.revisao}). A aprovação editorial anterior, se havia, deixou de valer.`);
    } catch (e) {
      console.error("[editor] Falha ao salvar:", e);
      setErro(e);
      if (e instanceof ApiError && e.resultadoIncerto) setTentativa({ uuid, chave: chaveTentativa, incerta: true });
    } finally {
      setEnviando(false);
    }
  };

  if (!trabalho.artigo_markdown) {
    return <Notice tone="info">Este trabalho ainda não tem artigo. Ele aparece aqui quando a etapa de redação concluir.</Notice>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rascunhoAntigo ? (
        <Notice tone="warning" title="Há alterações locais feitas sobre uma versão anterior">
          <p>Guardadas em {formatDateTime(rascunhoAntigo.salvo_em)} a partir da revisão {rascunhoAntigo.base_revisao}. Não foram carregadas para não sobrescrever a versão atual.</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => { setTexto(rascunhoAntigo.markdown); setRascunhoAntigo(null); setModo("lado"); }}>
              Carregar mesmo assim
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { window.localStorage.removeItem(chave); setRascunhoAntigo(null); }}>
              Descartar
            </button>
          </div>
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface px-2 py-1.5">
        <div className="inline-flex rounded-md border border-line-strong p-0.5" role="group" aria-label="Modo do artigo">
          {([
            ["leitura", "Leitura", Eye],
            ["edicao", "Editar Markdown", Pencil],
            ["lado", "Lado a lado", Columns2],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={modo === k}
              disabled={k !== "leitura" && !trabalho.acoes.pode_editar}
              title={k !== "leitura" && !trabalho.acoes.pode_editar ? trabalho.acoes.bloqueios.join(" ") : undefined}
              onClick={() => setModo(k)}
              className={clsx(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium disabled:opacity-50",
                k === "lado" && "hidden lg:inline-flex",
                modo === k ? "bg-brand-700 text-white" : "text-muted hover:bg-subtle",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted">{palavras.toLocaleString("pt-BR")} palavras</span>
        {sujo ? <span className="chip border-amber-300 bg-amber-50 text-amber-950" role="status">Alterações não salvas</span> : <span className="text-xs text-faint">Texto da v{trabalho.versao_artigo}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" className="btn-ghost btn-sm" onClick={() => void copiar()}><Copy className="h-3.5 w-3.5" aria-hidden /> Copiar</button>
          <button type="button" className="btn-ghost btn-sm" onClick={baixar}><Download className="h-3.5 w-3.5" aria-hidden /> Baixar .md</button>
          {sujo ? <button type="button" className="btn-ghost btn-sm" onClick={() => window.confirm("Descartar as alterações não salvas?") && setTexto(atual)}>Descartar</button> : null}
          {trabalho.acoes.pode_editar ? (
            <button type="button" className="btn-primary btn-sm" disabled={!sujo} onClick={() => setSalvarAberto(true)}>
              <Save className="h-3.5 w-3.5" aria-hidden /> Salvar nova versão
            </button>
          ) : null}
        </div>
      </div>

      <div className={clsx(modo === "lado" && "lg:grid lg:grid-cols-2 lg:gap-4")}>
        {modo !== "leitura" ? (
          <div>
            <label htmlFor={`md-${trabalho.job_key}`} className="sr-only">Markdown do artigo</label>
            <textarea id={`md-${trabalho.job_key}`} className="textarea min-h-[60vh] resize-y" value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck lang="pt-BR" />
          </div>
        ) : null}
        {modo !== "edicao" ? (
          <div className={clsx("card px-4 py-5 sm:px-8 sm:py-7", modo === "lado" && "mt-4 lg:mt-0 lg:max-h-[75vh] lg:overflow-y-auto")}>
            {sujo ? <p className="mb-3 font-sans text-xs font-medium text-amber-800">Prévia com alterações não salvas</p> : null}
            <MarkdownView markdown={texto} baseUrl="https://altovaletopteam.com.br/" />
          </div>
        ) : null}
      </div>

      <Dialog
        open={salvarAberto}
        onClose={() => !enviando && setSalvarAberto(false)}
        title={`Salvar como v${trabalho.versao_artigo + 1}`}
        description="A edição cria uma nova versão no n8n. Qualquer aprovação editorial anterior deixa de valer e o trabalho volta para “aguardando editor”."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSalvarAberto(false)} disabled={enviando}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={() => void salvar()} disabled={enviando}>Salvar nova versão</button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Base: v{trabalho.versao_artigo} (<code className="font-mono text-xs">{(trabalho.artigo_sha256 ?? "").slice(0, 12)}…</code>), revisão do registro {trabalho.revisao}.
            {ambiente === "teste" ? " Ambiente de teste." : " Ambiente de produção."}
          </p>
          {trabalho.pendencias.length ? <p className="text-muted">As {trabalho.pendencias.length} pendências do Revisor continuam registradas após a edição.</p> : null}
          <ActionError error={erro} />
        </div>
      </Dialog>
    </div>
  );
}
