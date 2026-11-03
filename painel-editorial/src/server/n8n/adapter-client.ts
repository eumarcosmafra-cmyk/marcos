import "server-only";
import { getConfig } from "../config";
import { PainelError } from "../painel-error";

/**
 * Cliente do workflow adaptador no n8n. Só roda no servidor do painel.
 * A URL é interna (rede Docker da VPS) e o token vai em cabeçalho; nenhum dos
 * dois chega ao navegador.
 */

export type AdapterOperation =
  | "consultar"
  | "salvar_edicao"
  | "decidir"
  | "preparar_correcao"
  | "retomar_producao"
  | "ler_trabalho"
  | "ler_versao"
  | "ler_resumos";

export interface AdapterEnvelope {
  ok?: boolean;
  erro?: { codigo?: string; mensagem?: string; detalhe?: unknown } | string;
  resultado?: unknown;
  [k: string]: unknown;
}

export async function callAdapter(operacao: AdapterOperation, entrada: Record<string, unknown>): Promise<AdapterEnvelope> {
  const cfg = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.adapterTimeoutMs);
  let res: Response;
  try {
    res = await fetch(cfg.adapterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Painel-Token": cfg.adapterToken },
      body: JSON.stringify({ operacao, entrada }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    console.error("[adapter] Falha de rede ao chamar o n8n:", aborted ? "timeout" : e);
    throw new PainelError(
      aborted ? "N8N_TEMPO_ESGOTADO" : "N8N_INDISPONIVEL",
      aborted ? "O n8n não respondeu dentro do tempo limite." : "Não foi possível conectar ao n8n.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body: AdapterEnvelope;
  try {
    body = JSON.parse(text) as AdapterEnvelope;
  } catch {
    console.error("[adapter] Resposta não-JSON do n8n:", res.status, text.slice(0, 300));
    throw new PainelError("N8N_RESPOSTA_INVALIDA", `O n8n respondeu em formato inesperado (HTTP ${res.status}).`, 502);
  }
  if (res.status === 401 || res.status === 403) {
    console.error("[adapter] n8n recusou a autenticação do painel:", res.status);
    throw new PainelError("N8N_AUTENTICACAO", "O n8n recusou a credencial do painel.", 502);
  }
  if (res.status === 404) {
    throw new PainelError("N8N_ADAPTADOR_AUSENTE", "O workflow adaptador não está publicado no n8n.", 502);
  }
  if (res.status >= 500) {
    console.error("[adapter] Erro do n8n:", res.status, text.slice(0, 500));
    throw new PainelError("N8N_ERRO", `O n8n retornou erro (HTTP ${res.status}).`, 502);
  }
  return body;
}
