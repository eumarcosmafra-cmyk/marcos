/**
 * Conversão da resposta da fila (n8n) para o formato entregue ao navegador.
 * Sem "server-only" para poder ser testado; não contém segredos.
 * Tudo que não está listado aqui é descartado.
 */
import {
  CHAMADAS_POR_ETAPA,
  ESTADOS_APROVAVEIS,
  ESTADOS_DEVOLVIVEIS,
  PROXIMA_ETAPA,
  type AcoesDTO,
  type ChamadasDTO,
  type Ambiente,
  type ControleDTO,
  type DecisaoDTO,
  type HistoricoDTO,
  type TrabalhoDTO,
  type TrabalhoResumoDTO,
  type VersaoMetaDTO,
} from "@/lib/fila-types";

type Rec = Record<string, unknown>;

export function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const str = (v: unknown, max = 500): string | null => (typeof v === "string" ? v.slice(0, max) : null);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const bool = (v: unknown): boolean => v === true;

export interface ResumoLeitura {
  job_key: string;
  titulo_pauta: string | null;
  titulo_artigo: string | null;
  modo_execucao: "real" | "simulado" | null;
  atualizado_em: string | null;
}

export function sanitizeResumos(v: unknown): Map<string, ResumoLeitura> {
  const map = new Map<string, ResumoLeitura>();
  const list = isRec(v) && Array.isArray(v.resumos) ? v.resumos : [];
  for (const r of list) {
    if (!isRec(r) || typeof r.job_key !== "string") continue;
    map.set(r.job_key, {
      job_key: r.job_key,
      titulo_pauta: str(r.titulo_pauta, 300),
      titulo_artigo: str(r.titulo_artigo, 300),
      modo_execucao: r.modo_execucao === "simulado" ? "simulado" : r.modo_execucao === "real" ? "real" : null,
      atualizado_em: str(r.atualizado_em, 40),
    });
  }
  return map;
}

function sanitizeControle(v: unknown): ControleDTO {
  const c = isRec(v) ? v : {};
  return {
    aprovacao_editorial: bool(c.aprovacao_editorial),
    // O contrato atual não registra revisão do professor nem autorização de publicação pelo painel.
    aprovacao_professor: bool(c.aprovacao_professor),
    publicacao_autorizada: bool(c.publicacao_autorizada),
  };
}

export function sanitizeDecisao(v: unknown): DecisaoDTO | null {
  if (!isRec(v) || (v.decisao !== "aprovar" && v.decisao !== "devolver")) return null;
  return {
    decisao: v.decisao,
    nome: str(v.nome, 120) ?? str(v.ator_id, 120) ?? "—",
    tipo_revisao: str(v.tipo_revisao, 60) ?? "editorial",
    versao_artigo: num(v.versao_artigo),
    artigo_sha256: str(v.artigo_sha256, 64) ?? "",
    motivos: Array.isArray(v.motivos) ? v.motivos.filter((m): m is string => typeof m === "string").map((m) => m.slice(0, 3000)) : [],
    justificativa_pendencias: str(v.justificativa_pendencias, 3000),
    em: str(v.em, 40) ?? "",
    simulacao: bool(v.simulacao),
  };
}

function sanitizeVersoes(v: unknown): VersaoMetaDTO[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRec).map((x) => ({
    numero: num(x.numero),
    sha256: str(x.sha256, 64) ?? "",
    origem: str(x.origem, 120) ?? "",
    em: str(x.em, 40) ?? "",
    completa: bool(x.completa),
  }));
}

function sanitizeHistorico(v: unknown): HistoricoDTO[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isRec).map((h) => {
    const detalhes: Record<string, string | number | boolean> = {};
    for (const [k, val] of Object.entries(h)) {
      if (["evento", "em", "ator", "etapa", "simulacao"].includes(k) || /sha256/.test(k)) continue;
      if (typeof val === "string") detalhes[k] = val.slice(0, 300);
      else if (typeof val === "number" || typeof val === "boolean") detalhes[k] = val;
    }
    return {
      evento: str(h.evento, 80) ?? "evento",
      em: str(h.em, 40),
      ator: str(h.ator, 80),
      etapa: str(h.etapa, 60),
      simulacao: typeof h.simulacao === "boolean" ? h.simulacao : null,
      detalhes,
    };
  });
}

function pendencias(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((p): p is string => typeof p === "string").map((p) => p.slice(0, 3000)) : [];
}

export function sanitizeResumo(raw: unknown, ambiente: Ambiente, extra?: ResumoLeitura): TrabalhoResumoDTO | null {
  if (!isRec(raw) || typeof raw.job_key !== "string" || raw.ambiente !== ambiente) return null;
  return {
    job_key: raw.job_key,
    pauta_id: str(raw.pauta_id, 40) ?? "—",
    keyword: str(raw.keyword, 200) ?? "",
    titulo_pauta: extra?.titulo_pauta ?? null,
    titulo_artigo: extra?.titulo_artigo ?? null,
    ambiente,
    modo_execucao: extra?.modo_execucao ?? null,
    estado: str(raw.estado, 60) ?? "desconhecido",
    etapa: str(raw.etapa, 60) ?? "",
    revisao: num(raw.revisao),
    versao_artigo: num(raw.versao_artigo),
    artigo_sha256: str(raw.artigo_sha256, 64),
    pendencias_qtd: pendencias(raw.pendencias).length,
    decisao_atual: sanitizeDecisao(raw.decisao_atual),
    controle: sanitizeControle(raw.controle),
    em_execucao: isRec(raw.reserva),
    atualizado_em: extra?.atualizado_em ?? null,
  };
}

const NOME_ETAPA: Record<string, string> = { pesquisador: "Pesquisador", redator: "Redator", revisor: "Revisor" };

function acoesDeProducao(t: Omit<TrabalhoDTO, "acoes">, podeDecidir: boolean) {
  const bloqueios: string[] = [];
  const d = t.decisao_atual;
  const devolucaoVigente = t.estado === "devolvido" && d?.decisao === "devolver" && d.artigo_sha256 === t.artigo_sha256 && d.versao_artigo === t.versao_artigo;
  let podeCorrigir = podeDecidir && !t.reserva && devolucaoVigente;
  if (devolucaoVigente && !t.correcao_disponivel) {
    podeCorrigir = false;
    bloqueios.push("Este registro não tem o briefing do Pesquisador; a fila não aceita correção automática. Edite o texto manualmente.");
  }
  const etapa = PROXIMA_ETAPA[t.estado];
  let podeRetomar = podeDecidir && !t.reserva && Boolean(etapa);
  if (etapa && t.chamadas.limite_do_ciclo !== null) {
    const restantes = t.chamadas.limite_do_ciclo - t.chamadas.reservadas;
    if (restantes < CHAMADAS_POR_ETAPA[etapa]) {
      podeRetomar = false;
      bloqueios.push(
        `Limite de chamadas deste ciclo atingido (${t.chamadas.reservadas} de ${t.chamadas.limite_do_ciclo}); a fila recusa a etapa ${NOME_ETAPA[etapa]}.`,
      );
    }
  }
  if (t.estado === "bloqueado_integridade") {
    bloqueios.push("O resultado de um agente não passou na conferência da fila (motivo nas Pendências). A saída prevista é editar o texto e salvar uma nova versão.");
  }
  if (t.estado === "resultado_incerto") bloqueios.push("Uma etapa terminou com resultado incerto: confira a execução antes de autorizar qualquer nova chamada (a fila não repete sozinha).");
  return { podeCorrigir, podeRetomar, bloqueios };
}

export function computeAcoes(t: Omit<TrabalhoDTO, "acoes">, podeDecidir: boolean): AcoesDTO {
  const bloqueios: string[] = [];
  const atual = t.versoes.find((v) => v.numero === t.versao_artigo);
  if (!podeDecidir) bloqueios.push("Seu usuário pode apenas consultar.");
  if (t.reserva) bloqueios.push(`Há uma etapa em execução (${t.reserva.etapa}); aguarde a conclusão.`);
  if (!t.artigo_markdown || !atual) bloqueios.push("Ainda não existe artigo para revisar.");
  else if (!atual.completa) bloqueios.push("A versão atual está incompleta.");
  const base = podeDecidir && !t.reserva && Boolean(atual);
  const completa = Boolean(atual?.completa);
  const podeAprovar = base && completa && ESTADOS_APROVAVEIS.includes(t.estado);
  const podeDevolver = base && completa && ESTADOS_DEVOLVIVEIS.includes(t.estado);
  if (base && completa && !ESTADOS_APROVAVEIS.includes(t.estado)) {
    bloqueios.push(`O estado “${t.estado}” não aceita aprovação editorial pelo contrato da fila.`);
  }
  const producao = acoesDeProducao(t, podeDecidir);
  return {
    pode_editar: base,
    pode_aprovar: podeAprovar,
    pode_devolver: podeDevolver,
    exige_avaliacao_pendencias: t.estado === "pendente_ajustes" || t.pendencias.length > 0,
    pode_solicitar_correcao: producao.podeCorrigir,
    pode_retomar_producao: producao.podeRetomar,
    em_producao: Boolean(t.reserva),
    bloqueios,
    bloqueios_producao: producao.bloqueios,
  };
}

function sanitizeChamadas(raw: Rec): ChamadasDTO {
  const limite = raw.max_api_ciclo;
  return {
    reservadas: num(raw.chamadas_api_reservadas),
    com_uso_confirmado: num(raw.chamadas_api_com_uso_confirmado),
    limite_do_ciclo: typeof limite === "number" && Number.isSafeInteger(limite) ? limite : null,
  };
}

/** Complementos que só a leitura sem trava (`ler_trabalho`) traz. */
export function resumoDeLeitura(raw: unknown): ResumoLeitura | undefined {
  if (!isRec(raw) || typeof raw.job_key !== "string" || raw.leitura_sem_trava !== true) return undefined;
  return sanitizeResumos({ resumos: [raw] }).get(raw.job_key);
}

export function sanitizeTrabalho(raw: unknown, ambiente: Ambiente, podeDecidir: boolean, extra?: ResumoLeitura): TrabalhoDTO | null {
  const resumo = sanitizeResumo(raw, ambiente, extra);
  if (!resumo || !isRec(raw)) return null;
  const reserva = isRec(raw.reserva)
    ? { etapa: str(raw.reserva.etapa, 60) ?? "", em: str(raw.reserva.em, 40) ?? "", execucao_id: str(raw.reserva.execucao_id, 40) }
    : null;
  const base: Omit<TrabalhoDTO, "acoes"> = {
    ...resumo,
    titulo_artigo: resumo.titulo_artigo ?? tituloH1(str(raw.artigo_markdown, 800000)),
    artigo_markdown: str(raw.artigo_markdown, 800000),
    versoes: sanitizeVersoes(raw.versoes),
    historico: sanitizeHistorico(raw.historico),
    pendencias: pendencias(raw.pendencias),
    pendencias_sha256: str(raw.pendencias_sha256, 64) ?? "",
    reserva,
    proxima_etapa: str(raw.proxima_etapa, 40),
    chamadas: sanitizeChamadas(raw),
    correcao_disponivel: bool(raw.correcao_disponivel),
  };
  return { ...base, acoes: computeAcoes(base, podeDecidir) };
}

export function tituloH1(markdown: string | null): string | null {
  if (!markdown) return null;
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(markdown);
  return m ? m[1].slice(0, 300) : null;
}
