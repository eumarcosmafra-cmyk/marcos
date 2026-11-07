"use client";

import type { ErroApi } from "@/lib/fila-types";

/** Erro de API com código estável, exibido na interface. */
export class ApiError extends Error {
  constructor(
    public readonly codigo: string,
    message: string,
    public readonly status: number,
    public readonly detalhe?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
  /** Falha de rede/tempo: o resultado de uma mutação é desconhecido. */
  get resultadoIncerto(): boolean {
    return this.status === 0 || this.codigo === "N8N_TEMPO_ESGOTADO" || this.codigo === "FILA_LIBERACAO_INCERTA";
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", "X-Painel-Requisicao": "1" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      credentials: "same-origin",
      signal: init?.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.error("[api] Falha de rede:", path, e);
    throw new ApiError("PAINEL_SEM_CONEXAO", "Sem conexão com o servidor do painel. Verifique a rede ou o túnel SSH.", 0);
  }
  let body: { ok?: boolean; erro?: ErroApi } | null = null;
  try {
    body = (await res.json()) as { ok?: boolean; erro?: ErroApi };
  } catch (e) {
    console.error("[api] Resposta não-JSON:", path, res.status, e);
    throw new ApiError("PAINEL_RESPOSTA_INVALIDA", `O servidor do painel respondeu em formato inesperado (HTTP ${res.status}).`, res.status);
  }
  if (!body || body.ok !== true) {
    const erro: ErroApi = body?.erro ?? { codigo: "ERRO_DESCONHECIDO", mensagem: "Erro desconhecido." };
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      const voltar = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/entrar?voltar=${voltar}`);
    }
    throw new ApiError(erro.codigo, erro.mensagem, res.status, erro.detalhe);
  }
  return body as unknown as T;
}

export function novoOpUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
