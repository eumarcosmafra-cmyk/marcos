/** Conversão da leitura de pautas do adaptador para o navegador. Sem "server-only" para ser testável. */
import type { Ambiente, TrabalhoResumoDTO } from "@/lib/fila-types";
import type { CandidatoFonteDTO, EstadoFontes, FontesPautaDTO, ListaPautasDTO, PautaDTO, PlanoDTO, PreviaFonteDTO, TrabalhoDaPautaDTO } from "@/lib/pautas-types";
import { isRec } from "../fila/sanitize";

type Rec = Record<string, unknown>;
const str = (v: unknown, max = 500): string | null => (typeof v === "string" ? v.slice(0, max) : null);
const strs = (v: unknown, max = 500): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, max)) : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ESTADOS: EstadoFontes[] = ["nenhuma", "proposta", "insuficiente", "aprovada"];

function previa(v: Rec): PreviaFonteDTO {
  return {
    id: str(v.id, 10) ?? "",
    url: str(v.url) ?? "",
    dominio: str(v.dominio, 200),
    titulo: str(v.titulo, 300) ?? "",
    entidade: str(v.entidade, 300) ?? "",
    localizador: str(v.localizador, 300) ?? "",
    limites: str(v.limites, 600) ?? "",
    trecho: str(v.trecho, 1600) ?? "",
    caracteres: num(v.caracteres) ?? 0,
  };
}

function candidato(v: Rec): CandidatoFonteDTO {
  return {
    id: str(v.id, 10) ?? "",
    origem: str(v.origem, 20),
    url: str(v.url),
    dominio: str(v.dominio, 200),
    titulo: str(v.titulo, 300),
    situacao: str(v.situacao, 30),
    motivo: str(v.motivo, 80),
    fonte: str(v.fonte, 10),
  };
}

function fontes(v: unknown): FontesPautaDTO {
  const f = isRec(v) ? v : {};
  const estado = ESTADOS.includes(f.estado as EstadoFontes) ? (f.estado as EstadoFontes) : "nenhuma";
  const p = isRec(f.proposta) ? f.proposta : null;
  const sel = p && isRec(p.selecao) ? p.selecao : {};
  return {
    estado,
    proposta: p
      ? {
          status: str(p.status, 20) ?? "",
          motivo: str(p.motivo, 80),
          gerado_em: str(p.gerado_em, 40),
          previas: Array.isArray(p.previas) ? p.previas.filter(isRec).map(previa) : [],
          candidatos: Array.isArray(p.candidatos) ? p.candidatos.filter(isRec).map(candidato) : [],
          metodo: str(sel.metodo, 20),
          chamadas_ia: num(sel.chamadas_ia) ?? 0,
          observacao: str(sel.observacao, 600),
          urls_extras: strs(p.urls_extras),
        }
      : null,
    aprovada_em: str(f.aprovada_em, 40),
    documentos: Array.isArray(f.documentos)
      ? f.documentos.filter(isRec).map((d) => ({
          id: str(d.id, 10) ?? "",
          url: str(d.url) ?? "",
          titulo: str(d.titulo, 300) ?? "",
          entidade: str(d.entidade, 300) ?? "",
          localizador: str(d.localizador, 300) ?? "",
          limites: str(d.limites, 600) ?? "",
        }))
      : [],
  };
}

function pauta(v: Rec, trabalhos: TrabalhoDaPautaDTO[]): PautaDTO | null {
  const id = str(v.id, 10);
  if (!id || !/^P\d{3,6}$/.test(id)) return null;
  return {
    id,
    keyword: str(v.keyword, 300) ?? "",
    titulo: str(v.titulo, 300) ?? "",
    acao: str(v.acao, 20) ?? "",
    intencao: str(v.intencao, 40),
    prioridade: str(v.prioridade, 20),
    status: str(v.status, 40),
    tema: str(v.tema, 200),
    justificativa: str(v.justificativa, 2000),
    diferenca_acervo: str(v.diferenca_acervo, 2000),
    apuracao_pendente: strs(v.apuracao_pendente, 1000),
    links_internos: strs(v.links_internos),
    volume: num(v.volume),
    secundarias: strs(v.secundarias, 300),
    serp: Array.isArray(v.serp)
      ? v.serp.filter(isRec).map((s) => ({ rank: num(s.rank), titulo: str(s.titulo, 200) ?? "", site: str(s.site, 120) ?? "", url: str(s.url) ?? "", video: s.video === true }))
      : [],
    integra: v.integra === true,
    fontes: fontes(v.fontes),
    trabalhos,
  };
}

/** Junta a leitura de pautas com os trabalhos da fila (por pauta_id) de cada ambiente consultado. */
export function sanitizePautas(raw: unknown, fila: Partial<Record<Ambiente, TrabalhoResumoDTO[]>>): ListaPautasDTO {
  const r = isRec(raw) ? raw : {};
  const porPauta = new Map<string, TrabalhoDaPautaDTO[]>();
  for (const [amb, lista] of Object.entries(fila) as [Ambiente, TrabalhoResumoDTO[] | undefined][]) {
    for (const t of lista ?? []) {
      const l = porPauta.get(t.pauta_id) ?? [];
      l.push({ ambiente: amb, job_key: t.job_key, estado: t.estado, versao_artigo: t.versao_artigo });
      porPauta.set(t.pauta_id, l);
    }
  }
  const planos: PlanoDTO[] = (Array.isArray(r.planos) ? r.planos : []).filter(isRec).flatMap((p: Rec) => {
    const planoId = str(p.plano_id, 120);
    const chave = str(p.plano_cache_key, 250);
    if (!planoId || !chave || !/^v2_[a-f0-9]{64}$/.test(planoId)) return [];
    const pautas = (Array.isArray(p.pautas) ? p.pautas : [])
      .filter(isRec)
      .map((x) => pauta(x, porPauta.get(String(x.id)) ?? []))
      .filter((x): x is PautaDTO => x !== null);
    return [{ plano_id: planoId, plano_cache_key: chave, criado_em: str(p.criado_em, 40), site_url: str(p.site_url), pautas }];
  });
  const falhas = (Array.isArray(r.falhas) ? r.falhas : []).filter(isRec).map((f) => ({ cache_key: str(f.cache_key, 250) ?? "", codigo: str(f.codigo, 60) ?? "" }));
  return { planos, falhas, fila_consultada: Object.keys(fila).length > 0 };
}
