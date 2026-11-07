/**
 * Mapeamento das saídas existentes dos workflows (n8n) para o domínio do painel.
 *
 * Este módulo é a referência para o adaptador futuro. Ele é tolerante a campos
 * ausentes: nada é inventado — o que não vier no dado fica vazio e é listado em
 * `missingFields` para que a interface mostre um estado vazio compreensível.
 */
import type { KnownWorkflowStatus, QualityFlagKind, SourceCategory } from "./types";

export const KNOWN_STATUSES: Record<KnownWorkflowStatus, { label: string; effect: string }> = {
  aguardando_revisao_humana: {
    label: "Aguardando revisão humana",
    effect: "Entra na fila de revisão editorial.",
  },
  revisao_obrigatoria_legibilidade: {
    label: "Revisão obrigatória — legibilidade",
    effect: "Abre pendência de legibilidade com os motivos recebidos.",
  },
  revisao_obrigatoria_fontes: {
    label: "Revisão obrigatória — fontes",
    effect: "Abre pendência de fontes com os motivos recebidos.",
  },
};

export interface StatusMapping {
  inReviewQueue: boolean;
  flags: { kind: QualityFlagKind; originalStatus: KnownWorkflowStatus }[];
  /** Status recebidos que o painel ainda não sabe interpretar (preservados). */
  unknownStatuses: string[];
}

export function mapWorkflowStatuses(statuses: string[]): StatusMapping {
  const result: StatusMapping = { inReviewQueue: false, flags: [], unknownStatuses: [] };
  for (const raw of statuses) {
    const s = raw.trim();
    if (s === "aguardando_revisao_humana") result.inReviewQueue = true;
    else if (s === "revisao_obrigatoria_legibilidade") {
      result.inReviewQueue = true;
      result.flags.push({ kind: "legibilidade", originalStatus: s });
    } else if (s === "revisao_obrigatoria_fontes") {
      result.inReviewQueue = true;
      result.flags.push({ kind: "fontes", originalStatus: s });
    } else if (s) result.unknownStatuses.push(s);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Saída de redação                                                    */
/* ------------------------------------------------------------------ */

/** Campos que a saída de redação pode conter hoje. Todos opcionais. */
export const REDACAO_FIELDS = [
  "cliente_id",
  "palavra_chave",
  "briefing_markdown",
  "artigo_markdown",
  "palavras",
  "avisos",
  "legibilidade",
  "citacoes",
  "fontes_dominio",
  "fontes_metodo",
  "rag_hibrido",
  "controle",
] as const;

export type RedacaoField = (typeof REDACAO_FIELDS)[number];

export interface AdaptedChunk {
  category: SourceCategory;
  title?: string;
  url?: string;
  text: string;
  chunkId?: string;
  retrievedAt?: string;
  similarity?: number;
}

export interface AdaptedRedacao {
  clienteId?: string;
  keyword?: string;
  briefingMarkdown?: string;
  articleMarkdown?: string;
  words?: number;
  warnings: string[];
  readability: { summary?: string; reasons: string[] };
  citations: { title?: string; url?: string }[];
  chunks: AdaptedChunk[];
  controle: Record<string, string | number | boolean>;
  statuses: string[];
  missingFields: RedacaoField[];
}

type Rec = Record<string, unknown>;

function isRecord(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function strList(v: unknown): string[] {
  if (typeof v === "string" && v.trim()) return [v.trim()];
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => (typeof x === "string" && x.trim() ? [x.trim()] : isRecord(x) && str(x.mensagem ?? x.message ?? x.motivo) ? [String(x.mensagem ?? x.message ?? x.motivo)] : []));
}

function pick(rec: Rec, keys: string[]): unknown {
  for (const k of keys) if (k in rec) return rec[k];
  return undefined;
}

function toChunk(item: unknown, category: SourceCategory): AdaptedChunk | null {
  if (!isRecord(item)) return null;
  const text = str(pick(item, ["texto", "trecho", "conteudo", "content", "text", "chunk"]));
  if (!text) return null;
  return {
    category,
    text,
    title: str(pick(item, ["titulo", "title", "fonte", "source"])),
    url: str(pick(item, ["url", "link", "source_url"])),
    chunkId: str(pick(item, ["chunk_id", "id_chunk", "id"])) ?? (typeof item.id === "number" ? String(item.id) : undefined),
    retrievedAt: str(pick(item, ["recuperado_em", "retrieved_at", "coletado_em", "timestamp"])),
    // Similaridade só é preservada quando vier no dado original.
    similarity: num(pick(item, ["similaridade", "similarity", "score"])),
  };
}

function chunkList(v: unknown, category: SourceCategory): AdaptedChunk[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => toChunk(x, category)).filter((x): x is AdaptedChunk => x !== null);
}

function categoryFromHint(hint: unknown): SourceCategory | null {
  const h = typeof hint === "string" ? hint.toLowerCase() : "";
  if (/dominio|domínio|assunto|fato/.test(h)) return "dominio";
  if (/metodo|método|seo|editorial/.test(h)) return "metodo";
  if (/cliente|marca|empresa/.test(h)) return "cliente";
  return null;
}

/**
 * Converte uma saída bruta de redação em estruturas do painel.
 * Não persiste nada; quem chama decide como gravar (versão, execução, trechos).
 */
export function adaptRedacaoOutput(raw: unknown): AdaptedRedacao {
  const rec: Rec = isRecord(raw) ? raw : {};
  const missingFields = REDACAO_FIELDS.filter((f) => rec[f] === undefined || rec[f] === null || rec[f] === "");

  const legibilidade = rec.legibilidade;
  const readability = isRecord(legibilidade)
    ? {
        summary: str(pick(legibilidade, ["resumo", "summary", "nivel", "status"])),
        reasons: strList(pick(legibilidade, ["motivos", "reasons", "problemas"])),
      }
    : { summary: str(legibilidade), reasons: [] };

  const citations: { title?: string; url?: string }[] = Array.isArray(rec.citacoes)
    ? rec.citacoes.flatMap((c: unknown): { title?: string; url?: string }[] =>
        isRecord(c)
          ? [{ title: str(pick(c, ["titulo", "title"])), url: str(pick(c, ["url", "link"])) }]
          : typeof c === "string"
            ? [{ url: c }]
            : [],
      )
    : [];

  const chunks: AdaptedChunk[] = [
    ...chunkList(rec.fontes_dominio, "dominio"),
    ...chunkList(rec.fontes_metodo, "metodo"),
  ];
  if (Array.isArray(rec.rag_hibrido)) {
    for (const item of rec.rag_hibrido) {
      if (!isRecord(item)) continue;
      const cat = categoryFromHint(pick(item, ["categoria", "tipo", "base", "colecao"]));
      // Sem categoria declarada, o trecho NÃO é classificado por suposição.
      if (!cat) continue;
      const c = toChunk(item, cat);
      if (c) chunks.push(c);
    }
  }

  const controle: Record<string, string | number | boolean> = {};
  if (isRecord(rec.controle)) {
    for (const [k, v] of Object.entries(rec.controle)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") controle[k] = v;
    }
  }
  const statuses = strList(isRecord(rec.controle) ? pick(rec.controle, ["status", "status_revisao", "statuses"]) : undefined);

  return {
    clienteId: str(rec.cliente_id) ?? (typeof rec.cliente_id === "number" ? String(rec.cliente_id) : undefined),
    keyword: str(rec.palavra_chave),
    briefingMarkdown: str(rec.briefing_markdown),
    articleMarkdown: str(rec.artigo_markdown),
    words: num(rec.palavras),
    warnings: strList(rec.avisos),
    readability,
    citations,
    chunks,
    controle,
    statuses,
    missingFields,
  };
}
