"use client";

import { ArrowLeft, Bot, CheckCircle2, ExternalLink, FileSearch, Loader2, Play, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ambiente } from "@/lib/fila-types";
import type { ListaPautasDTO, PautaDTO, PlanoDTO } from "@/lib/pautas-types";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/state/toast";
import { Link } from "@/state/unsaved-guard";
import { Dialog, KeyValue, Notice, SectionCard, StatusBadge } from "@/components/ui";
import { api, ApiError, novoOpUuid } from "./api";
import { estadoMeta } from "./labels";
import { ActionError, LoadError } from "./load-state";
import { ESTADO_FONTES, MOTIVO_CANDIDATO, SITUACAO_CANDIDATO } from "./pautas-labels";

type Resposta = ListaPautasDTO & { consultado_em: string };
const ACOMPANHAR_MS = 8000;
const LIMITE_BUSCA_MS = 6 * 60 * 1000;

function BuscarFontesDialog({ pauta, base, onClose, onDone }: { pauta: PautaDTO; base: string; onClose: () => void; onDone: () => void }) {
  const [urls, setUrls] = useState((pauta.fontes.proposta?.urls_extras ?? []).join("\n"));
  const [autorizo, setAutorizo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const lista = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
  const invalidas = lista.filter((u) => !/^https:\/\/[^\s/@:]+\/\S*$/.test(u));

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api(`${base}/fontes`, { method: "POST", body: { autorizo_chamadas_pagas: true, urls_extras: lista } });
      onDone();
    } catch (e) {
      console.error("[pauta] Busca de fontes falhou:", e);
      setErro(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => !enviando && onClose()}
      size="lg"
      title={`Buscar fontes para ${pauta.id}`}
      description="O painel coleta as páginas da SERP desta pauta (e as URLs que você informar), recorta a seção mais relevante de cada uma e pede ao modelo para escolher as 3 melhores. Você aprova antes de produzir."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!autorizo || enviando || invalidas.length > 0 || lista.length > 5} onClick={() => void enviar()}>
            <Search className="h-4 w-4" aria-hidden /> Buscar fontes
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="urls-extras" className="field-label">URLs de fontes que você já conhece (opcional, até 5, uma por linha)</label>
          <textarea id="urls-extras" className="input font-mono text-xs" rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder="https://www.federacao.org.br/regras/" />
          {invalidas.length ? <p className="field-hint text-red-800">Use URLs completas com https:// e caminho: {invalidas.join(", ")}</p> : <p className="field-hint">Entram na frente dos resultados da SERP.</p>}
        </div>
        <Notice tone="info">
          Custo: coleta das páginas pelo Crawl4AI (servidor próprio) e <strong>1 chamada ao DeepSeek</strong> para escolher entre as páginas coletadas. Valor em reais não informado pela ferramenta. Leva de 1 a 4 minutos.
        </Notice>
        <p className="text-xs text-muted">O modelo só escolhe entre páginas reais coletadas e escreve a entidade e os limites de cada fonte; os trechos são recortados por código e conferidos com a mesma regra do Pesquisador.</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} />
          <span>Autorizo 1 chamada paga de API para buscar fontes desta pauta.</span>
        </label>
        <ActionError error={erro} />
      </div>
    </Dialog>
  );
}

function ProduzirDialog({ pauta, base, ambientes, onClose }: { pauta: PautaDTO; base: string; ambientes: Ambiente[]; onClose: () => void }) {
  const router = useRouter();
  const [ambiente, setAmbiente] = useState<Ambiente>(ambientes.includes("producao") ? "producao" : "teste");
  const [autorizo, setAutorizo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const [uuid] = useState(novoOpUuid);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await api<{ job_key: string; producao_iniciada: boolean; erro_producao: { codigo: string; mensagem: string } | null }>(`${base}/produzir`, {
        method: "POST",
        body: { op_uuid: uuid, ambiente, autorizo_chamadas_pagas: true },
      });
      const qs = new URLSearchParams();
      if (ambiente === "teste") qs.set("ambiente", "teste");
      if (r.producao_iniciada) qs.set("acompanhar", "1");
      router.push(`/fila/${r.job_key}?${qs.toString()}`);
    } catch (e) {
      console.error("[pauta] Produção falhou:", e);
      setErro(e);
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open
      onClose={() => !enviando && onClose()}
      size="lg"
      title={`Produzir artigo: ${pauta.titulo}`}
      description="Coloca a pauta na fila com as 3 fontes aprovadas e dispara Pesquisador → Redator → Revisor. O artigo chega à fila para a sua revisão; nada é publicado."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button type="button" className="btn-primary" disabled={!autorizo || enviando} onClick={() => void enviar()}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />} Autorizar e produzir
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {ambientes.length > 1 ? (
          <fieldset>
            <legend className="field-label">Ambiente</legend>
            <div className="flex gap-4 text-sm">
              {ambientes.map((a) => (
                <label key={a} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="ambiente" checked={ambiente === a} onChange={() => setAmbiente(a)} /> {a === "producao" ? "Produção" : "Teste (decisões viram simulação)"}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <section className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-3 text-sm">
          <h3 className="mb-1 font-semibold text-amber-950">Chamadas pagas de API</h3>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Até <strong>4</strong> chamadas: Pesquisador (1) + Redator (1) + Revisor (2). A fila reserva cada uma antes de executar e não repete sozinha em caso de falha.</li>
            <li>Valor em reais: não informado pela ferramenta.</li>
            <li>As etapas rodam em segundo plano (limite de 30 min); a tela da fila acompanha.</li>
          </ul>
        </section>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} />
          <span>Autorizo até 4 chamadas pagas de API para produzir o artigo da pauta {pauta.id} ({ambiente === "producao" ? "produção" : "teste"}).</span>
        </label>
        <ActionError error={erro} />
      </div>
    </Dialog>
  );
}

function Fontes({ pauta, base, podeEditar, onChange, aguardando }: { pauta: PautaDTO; base: string; podeEditar: boolean; onChange: (busca: boolean) => void; aguardando: boolean }) {
  const toast = useToast();
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const f = pauta.fontes;
  const p = f.proposta;

  const aprovar = async () => {
    setAprovando(true);
    setErro(null);
    try {
      await api(`${base}/fontes/aprovar`, { method: "POST" });
      toast.show({ tone: "success", message: `Fontes de ${pauta.id} aprovadas. A pauta pode ir para produção.` });
      onChange(false);
    } catch (e) {
      console.error("[pauta] Aprovação de fontes falhou:", e);
      setErro(e);
    } finally {
      setAprovando(false);
    }
  };

  const aprovadas = new Set(f.documentos.map((d) => d.url));
  const propostaJaAprovada = Boolean(p && p.status === "pronta" && p.previas.length === f.documentos.length && p.previas.every((x) => aprovadas.has(x.url)));

  return (
    <SectionCard
      title="Fontes"
      description="Três fontes por pauta, cada uma com o trecho que o Pesquisador vai usar."
      actions={
        podeEditar ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(true)} disabled={aguardando}>
            <FileSearch className="h-4 w-4" aria-hidden /> {p ? "Buscar de novo" : "Buscar fontes"}
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge meta={ESTADO_FONTES[f.estado]} />
          {f.aprovada_em ? <span className="text-xs text-muted">aprovadas em {formatDateTime(f.aprovada_em)}</span> : null}
          {p?.gerado_em ? <span className="text-xs text-muted">· última busca em {formatDateTime(p.gerado_em)}</span> : null}
        </div>
        {aguardando ? (
          <Notice tone="info" icon={Bot}>
            <span role="status">Buscando fontes: coletando as páginas e escolhendo as 3 melhores. Esta tela atualiza sozinha.</span>
          </Notice>
        ) : null}
        {f.estado === "nenhuma" && !aguardando ? <p className="text-sm text-muted">Nenhuma busca de fontes feita para esta pauta.</p> : null}

        {p && p.status !== "pronta" ? (
          <Notice tone="warning" icon={TriangleAlert}>
            A última busca não achou 3 fontes utilizáveis ({p.motivo === "menos_de_tres_fontes_aptas" ? "menos de três páginas aptas" : p.motivo ?? "motivo não informado"}). Informe URLs de fontes que você conhece e busque de novo.
          </Notice>
        ) : null}

        {p && p.status === "pronta" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {propostaJaAprovada ? "Estas são as fontes aprovadas." : "Proposta da última busca"}
              {p.metodo === "modelo" ? " · escolhidas pelo modelo" : p.metodo === "automatica" ? " · escolha automática (o modelo não respondeu de forma válida)" : ""}
            </p>
            <ol className="flex flex-col gap-3">
              {p.previas.map((x) => (
                <li key={x.id} className="rounded-md border border-line px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{x.id} · {x.entidade}</p>
                  <a href={x.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-medium text-brand-800 hover:underline">
                    {x.titulo} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <p className="text-xs text-faint">{x.dominio} · seção: {x.localizador}</p>
                  <p className="mt-1 text-sm"><span className="font-medium">Limites:</span> {x.limites}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm text-brand-800">Ver trecho ({x.caracteres} caracteres)</summary>
                    <p className="mt-1 whitespace-pre-wrap rounded bg-subtle/60 px-2 py-2 text-xs text-ink">{x.trecho}{x.caracteres > x.trecho.length ? " […]" : ""}</p>
                  </details>
                </li>
              ))}
            </ol>
            {p.observacao ? <p className="text-xs text-muted">Observação do modelo: {p.observacao}</p> : null}
            {podeEditar && !propostaJaAprovada ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-primary" onClick={() => void aprovar()} disabled={aprovando || aguardando}>
                  {aprovando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  {f.estado === "aprovada" ? "Aprovar estas fontes (substitui as atuais)" : "Aprovar estas 3 fontes"}
                </button>
                <span className="text-xs text-muted">Sem custo. Confira os trechos antes.</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {f.estado === "aprovada" && !propostaJaAprovada && f.documentos.length ? (
          <div>
            <p className="mb-1 text-sm font-medium">Fontes aprovadas</p>
            <ul className="list-disc pl-5 text-sm">
              {f.documentos.map((d) => (
                <li key={d.id}>
                  {d.id} · {d.entidade} · <a className="text-brand-800 hover:underline" href={d.url} target="_blank" rel="noopener noreferrer">{d.titulo}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {p?.candidatos.length ? (
          <details>
            <summary className="cursor-pointer text-sm text-muted">Todos os candidatos avaliados ({p.candidatos.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {p.candidatos.map((c) => (
                <li key={c.id} className="flex flex-wrap gap-x-2">
                  <span className="font-mono">{c.id}</span>
                  <span className="font-medium">{SITUACAO_CANDIDATO[c.situacao ?? ""] ?? c.situacao}{c.fonte ? ` (${c.fonte})` : ""}</span>
                  <span className="text-muted">{c.dominio ?? c.titulo ?? c.url}</span>
                  {c.origem === "editor" ? <span className="text-faint">· informada por você</span> : null}
                  {c.motivo ? <span className="text-faint">· {MOTIVO_CANDIDATO[c.motivo] ?? c.motivo}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <ActionError error={erro} />
      </div>
    </SectionCard>
  );
}

export function PautaView({ planoId, pautaId }: { planoId: string; pautaId: string }) {
  const toast = useToast();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  const [lidoEm, setLidoEm] = useState(0);
  const [dialogo, setDialogo] = useState<"fontes" | "produzir" | null>(null);
  const [busca, setBusca] = useState<{ anterior: string | null; desde: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const base = `/api/pautas/${planoId}/${pautaId}`;

  const recarregar = useCallback(() => setTentativa((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setCarregando(true);
    api<Resposta>("/api/pautas", { signal: ctrl.signal })
      .then((r) => {
        setDados(r);
        setErro(null);
        setLidoEm(Date.now());
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[pauta] Erro ao carregar:", e);
        setErro(e);
      })
      .finally(() => setCarregando(false));
    return () => ctrl.abort();
  }, [tentativa]);

  const { plano, pauta } = useMemo(() => {
    const pl: PlanoDTO | undefined = dados?.planos.find((x) => x.plano_id === planoId);
    return { plano: pl, pauta: pl?.pautas.find((x) => x.id === pautaId) };
  }, [dados, planoId, pautaId]);

  // Acompanha a busca de fontes em segundo plano até aparecer uma proposta nova.
  useEffect(() => {
    if (!busca || carregando) return;
    const atual = pauta?.fontes.proposta?.gerado_em ?? null;
    if (lidoEm > busca.desde && atual && atual !== busca.anterior) {
      setBusca(null);
      toast.show({ tone: pauta?.fontes.proposta?.status === "pronta" ? "success" : "danger", message: pauta?.fontes.proposta?.status === "pronta" ? "Busca concluída: confira as 3 fontes propostas." : "Busca concluída sem 3 fontes utilizáveis." });
      return;
    }
    if (Date.now() - busca.desde > LIMITE_BUSCA_MS) {
      setBusca(null);
      setAviso("A busca de fontes não terminou em 6 minutos. Ela pode ter falhado no n8n; atualize a página ou busque de novo.");
      return;
    }
    const id = window.setTimeout(recarregar, ACOMPANHAR_MS);
    return () => window.clearTimeout(id);
  }, [busca, carregando, lidoEm, pauta, recarregar, toast]);

  const voltar = (
    <Link href="/pautas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Pautas
    </Link>
  );

  if (!dados) {
    return (
      <div>
        {voltar}
        {carregando ? (
          <p className="flex items-center gap-2 py-12 text-sm text-muted" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Lendo a pauta no n8n…
          </p>
        ) : (
          <LoadError error={erro} onRetry={recarregar} titulo="Não foi possível ler a pauta" />
        )}
      </div>
    );
  }
  if (!plano || !pauta) {
    return (
      <div>
        {voltar}
        <Notice tone="warning">Pauta {pautaId} não encontrada neste plano.</Notice>
      </div>
    );
  }

  const ambientes: Ambiente[] = ["producao", "teste"];
  const podeEditar = !(erro instanceof ApiError && erro.status === 403);
  const podeProduzir = pauta.fontes.estado === "aprovada" && !pauta.trabalhos.some((t) => t.ambiente === "producao");

  return (
    <div>
      {voltar}
      {erro ? (
        <div className="mb-3">
          <LoadError error={erro} onRetry={recarregar} titulo="Falha ao atualizar; exibindo a última leitura" />
        </div>
      ) : null}

      <header className="card mb-4 px-4 py-4">
        <p className="text-xs text-faint">
          <span className="font-mono font-medium text-muted">{pauta.id}</span> · plano de {formatDateTime(plano.criado_em ?? undefined)}
          {pauta.tema ? ` · ${pauta.tema}` : ""}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{pauta.titulo}</h1>
        <p className="text-sm text-muted">Palavra-chave: <strong className="font-medium text-ink">{pauta.keyword}</strong></p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-4">
          <KeyValue label="Intenção">{pauta.intencao ?? "—"}</KeyValue>
          <KeyValue label="Prioridade">{pauta.prioridade ?? "—"}</KeyValue>
          <KeyValue label="Ação">{pauta.acao}</KeyValue>
          <KeyValue label="Volume mensal">{pauta.volume ?? "não medido"}</KeyValue>
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {pauta.trabalhos.length ? (
            pauta.trabalhos.map((t) => (
              <Link key={t.job_key} href={`/fila/${t.job_key}${t.ambiente === "teste" ? "?ambiente=teste" : ""}`} className="btn-secondary">
                <StatusBadge meta={estadoMeta(t.estado)} size="sm" /> Ver artigo ({t.ambiente === "teste" ? "teste" : "produção"}, v{t.versao_artigo})
              </Link>
            ))
          ) : null}
          <button
            type="button"
            className="btn-primary"
            onClick={() => setDialogo("produzir")}
            disabled={!podeProduzir || !podeEditar}
            title={podeProduzir ? undefined : pauta.fontes.estado !== "aprovada" ? "Aprove as 3 fontes primeiro" : "Esta pauta já tem artigo em produção"}
          >
            <Play className="h-4 w-4" aria-hidden /> Produzir artigo
          </button>
          <button type="button" className="btn-ghost" onClick={recarregar} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />} Atualizar
          </button>
          {pauta.fontes.estado !== "aprovada" ? <span className="text-xs text-muted">Para produzir, aprove as 3 fontes abaixo.</span> : null}
        </div>
        {!pauta.integra ? <Notice tone="danger" className="mt-3">Esta pauta não confere com o hash gravado no plano; o Enfileirador vai recusá-la.</Notice> : null}
        {aviso ? <Notice tone="warning" className="mt-3">{aviso}</Notice> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Fontes
          pauta={pauta}
          base={base}
          podeEditar={podeEditar}
          aguardando={Boolean(busca)}
          onChange={(abrirBusca) => (abrirBusca ? setDialogo("fontes") : recarregar())}
        />
        <div className="flex flex-col gap-4">
          <SectionCard title="Por que esta pauta">
            <div className="flex flex-col gap-3 px-4 py-4 text-sm">
              {pauta.justificativa ? <p>{pauta.justificativa}</p> : null}
              {pauta.diferenca_acervo ? <p><span className="font-medium">Diferença para o blog atual:</span> {pauta.diferenca_acervo}</p> : null}
              {pauta.secundarias.length ? <p><span className="font-medium">Secundárias:</span> {pauta.secundarias.join(", ")}</p> : null}
              {pauta.apuracao_pendente.length ? (
                <div>
                  <p className="font-medium">Apuração pendente (o Planejador pediu cuidado):</p>
                  <ul className="list-disc pl-5">{pauta.apuracao_pendente.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              ) : null}
              {pauta.links_internos.length ? (
                <div>
                  <p className="font-medium">Links internos sugeridos:</p>
                  <ul className="list-disc break-all pl-5 text-xs">{pauta.links_internos.map((u) => <li key={u}>{u}</li>)}</ul>
                </div>
              ) : null}
            </div>
          </SectionCard>
          <SectionCard title="SERP coletada" description="Resultados orgânicos gravados no plano; servem de candidatos a fonte.">
            <ol className="flex flex-col gap-1 px-4 py-3 text-sm">
              {pauta.serp.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right text-faint">{s.rank ?? "—"}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{s.titulo || "(sem título)"}</span>
                    <span className="text-xs text-muted"> · {s.site}{s.video ? " · vídeo" : ""}</span>
                  </span>
                </li>
              ))}
              {!pauta.serp.length ? <li className="text-muted">Sem SERP gravada.</li> : null}
            </ol>
          </SectionCard>
        </div>
      </div>

      {dialogo === "fontes" ? (
        <BuscarFontesDialog
          pauta={pauta}
          base={base}
          onClose={() => setDialogo(null)}
          onDone={() => {
            setDialogo(null);
            setAviso(null);
            setBusca({ anterior: pauta.fontes.proposta?.gerado_em ?? null, desde: Date.now() });
            toast.show({ tone: "info", message: "Busca de fontes iniciada em segundo plano." });
            recarregar();
          }}
        />
      ) : null}
      {dialogo === "produzir" ? <ProduzirDialog pauta={pauta} base={base} ambientes={ambientes} onClose={() => setDialogo(null)} /> : null}
    </div>
  );
}
