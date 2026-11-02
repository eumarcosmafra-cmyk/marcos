"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Ambiente, TrabalhoDTO } from "@/lib/fila-types";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/state/toast";
import { Link } from "@/state/unsaved-guard";
import { Notice, StatusBadge, TabPanel, Tabs, type TabDef } from "@/components/ui";
import { api } from "./api";
import { AmbienteBadge } from "./badges";
import { DecisaoDialog } from "./decisao-dialog";
import { EditorReal } from "./editor-real";
import { HistoricoReal } from "./historico-real";
import { estadoMeta } from "./labels";
import { LoadError } from "./load-state";

type Aba = "artigo" | "pendencias" | "historico";

function Situacao({ titulo, valor, ok, icon: Icon, detalhe }: { titulo: string; valor: string; ok: boolean; icon: LucideIcon; detalhe?: string }) {
  return (
    <div className={clsx("rounded-md border px-3 py-2", ok ? "border-emerald-300 bg-emerald-50" : "border-line bg-subtle/60")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {titulo}
      </p>
      <p className={clsx("mt-0.5 flex items-center gap-1.5 text-sm font-semibold", ok ? "text-emerald-900" : "text-ink")}>
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4 text-muted" aria-hidden />}
        {valor}
      </p>
      {detalhe ? <p className="mt-0.5 text-xs text-muted">{detalhe}</p> : null}
    </div>
  );
}

function aprovacaoEditorial(t: TrabalhoDTO): { valor: string; ok: boolean; detalhe?: string } {
  const d = t.decisao_atual;
  const daAtual = d && d.artigo_sha256 === t.artigo_sha256 && d.versao_artigo === t.versao_artigo;
  if (t.controle.aprovacao_editorial && d) return { valor: `Aprovada na v${d.versao_artigo}`, ok: true, detalhe: `${d.nome} · ${formatDateTime(d.em)}` };
  if (t.estado === "aprovacao_simulada" && daAtual) return { valor: "Simulada (teste)", ok: false, detalhe: "Não vale como aprovação editorial." };
  if (d?.decisao === "devolver" && daAtual) return { valor: "Devolvida", ok: false, detalhe: `${d.nome} · ${formatDateTime(d.em)}` };
  return { valor: "Pendente", ok: false, detalhe: d && !daAtual ? `Última decisão refere-se à v${d.versao_artigo}.` : undefined };
}

export function TrabalhoView({ jobKey, ambiente }: { jobKey: string; ambiente: Ambiente }) {
  const toast = useToast();
  const [t, setT] = useState<TrabalhoDTO | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [aba, setAba] = useState<Aba>("artigo");
  const [decisao, setDecisao] = useState<"aprovar" | "devolver" | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarregando(true);
    setErro(null);
    api<{ trabalho: TrabalhoDTO }>(`/api/fila/${jobKey}?ambiente=${ambiente}`, { signal: ctrl.signal })
      .then((r) => setT(r.trabalho))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[trabalho] Erro ao carregar:", e);
        setErro(e);
      })
      .finally(() => setCarregando(false));
    return () => ctrl.abort();
  }, [jobKey, ambiente, tentativa]);

  const concluido = (mensagem: string) => {
    setDecisao(null);
    toast.show({ tone: "success", message: mensagem });
    setEditorKey((k) => k + 1);
    recarregar();
  };

  const voltar = (
    <Link href={ambiente === "teste" ? "/fila?ambiente=teste" : "/fila"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Fila editorial
    </Link>
  );

  if (!t) {
    return (
      <div>
        {voltar}
        {carregando ? (
          <p className="flex items-center gap-2 py-12 text-sm text-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consultando o trabalho no n8n…
          </p>
        ) : (
          <LoadError error={erro} onRetry={recarregar} titulo="Não foi possível abrir o trabalho" />
        )}
      </div>
    );
  }

  const ap = aprovacaoEditorial(t);
  const abas: TabDef<Aba>[] = [
    { key: "artigo", label: "Artigo", icon: FileText },
    { key: "pendencias", label: "Pendências do Revisor", icon: TriangleAlert, count: t.pendencias.length },
    { key: "historico", label: "Histórico e versões", icon: History, count: t.versoes.length },
  ];

  return (
    <div>
      {voltar}
      {erro ? (
        <div className="mb-3">
          <LoadError error={erro} onRetry={recarregar} titulo="Falha ao atualizar; exibindo a última leitura bem-sucedida" />
        </div>
      ) : null}

      <header className="card mb-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-faint">
          <span className="font-mono font-medium text-muted">{t.pauta_id}</span>
          <AmbienteBadge ambiente={t.ambiente} />
          {t.modo_execucao === "simulado" ? <span className="chip border-amber-300 bg-amber-50 text-amber-950">execução simulada</span> : null}
          <span className="font-mono">job {t.job_key.slice(0, 12)}…</span>
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{t.titulo_artigo ?? t.titulo_pauta ?? t.keyword}</h1>
        {t.titulo_pauta && t.titulo_pauta !== t.titulo_artigo ? <p className="text-sm text-muted">Título da pauta: {t.titulo_pauta}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge meta={estadoMeta(t.estado)} />
          <span className="text-muted">
            Palavra-chave: <strong className="font-medium text-ink">{t.keyword}</strong>
          </span>
          <span className="text-muted">
            Versão do artigo: <strong className="font-medium text-ink">v{t.versao_artigo}</strong>
          </span>
          <span className="text-muted">
            Revisão do registro: <strong className="font-medium text-ink">{t.revisao}</strong>
          </span>
          <span className="text-xs text-faint">etapa {t.etapa}</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Situacao titulo="Aprovação editorial" icon={BadgeCheck} {...ap} />
          <Situacao titulo="Revisão do professor" icon={GraduationCap} valor={t.controle.aprovacao_professor ? "Realizada" : "Não realizada"} ok={t.controle.aprovacao_professor} />
          <Situacao titulo="Publicação" icon={UploadCloud} valor={t.controle.publicacao_autorizada ? "Autorizada" : "Não autorizada"} ok={t.controle.publicacao_autorizada} detalhe="Publicação no site não é feita pelo painel nesta etapa." />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="btn-secondary" onClick={() => setDecisao("devolver")} disabled={!t.acoes.pode_devolver} title={t.acoes.pode_devolver ? undefined : t.acoes.bloqueios.join(" ")}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Devolver com motivos
          </button>
          <button type="button" className="btn-primary" onClick={() => setDecisao("aprovar")} disabled={!t.acoes.pode_aprovar} title={t.acoes.pode_aprovar ? undefined : t.acoes.bloqueios.join(" ")}>
            <BookOpenCheck className="h-4 w-4" aria-hidden /> Aprovar editorialmente
          </button>
          <button type="button" className="btn-ghost" onClick={recarregar} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Recarregar
          </button>
        </div>
        {t.acoes.bloqueios.length ? (
          <ul className="mt-2 list-disc pl-5 text-xs text-muted">
            {t.acoes.bloqueios.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {t.reserva ? <Notice tone="info" className="mt-3">Etapa “{t.reserva.etapa}” reservada em {formatDateTime(t.reserva.em)}. Ações ficam bloqueadas até a conclusão.</Notice> : null}
      </header>

      <Tabs tabs={abas} active={aba} onChange={setAba} idPrefix="trab" label="Áreas do trabalho" />
      <div className="pt-4">
        <div hidden={aba !== "artigo"}>
          <TabPanel idPrefix="trab" tabKey="artigo">
            <EditorReal key={`${t.artigo_sha256}-${editorKey}`} trabalho={t} ambiente={ambiente} onSaved={concluido} />
          </TabPanel>
        </div>
        {aba === "pendencias" ? (
          <TabPanel idPrefix="trab" tabKey="pendencias">
            {t.pendencias.length === 0 ? (
              <Notice tone="success">O Revisor não registrou pendências para este trabalho.</Notice>
            ) : (
              <div className="flex flex-col gap-3">
                <Notice tone="warning" icon={TriangleAlert}>
                  Para aprovar com pendências, a fila exige avaliação explícita de cada item e uma justificativa escrita por você. Identificação desta lista: <code className="font-mono text-xs">{t.pendencias_sha256.slice(0, 16)}…</code>
                </Notice>
                <ol className="flex flex-col gap-2">
                  {t.pendencias.map((p, i) => (
                    <li key={i} className="card px-4 py-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Pendência {i + 1}</p>
                      <p className="whitespace-pre-wrap">{p}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </TabPanel>
        ) : null}
        {aba === "historico" ? (
          <TabPanel idPrefix="trab" tabKey="historico">
            <HistoricoReal trabalho={t} ambiente={ambiente} />
          </TabPanel>
        ) : null}
      </div>

      {decisao ? <DecisaoDialog key={`${decisao}-${t.revisao}`} trabalho={t} ambiente={ambiente} tipo={decisao} onClose={() => setDecisao(null)} onDone={concluido} /> : null}
    </div>
  );
}
