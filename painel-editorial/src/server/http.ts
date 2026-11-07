import "server-only";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ConfigError, getConfig } from "./config";
import { PainelError } from "./painel-error";
import { podeDecidir, readSessionToken, resolveSessionUser, SESSION_COOKIE, type SessionUser } from "./auth/session";

export { PainelError };

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof PainelError) {
    return NextResponse.json({ ok: false, erro: { codigo: e.code, mensagem: e.message, ...(e.detail ? { detalhe: e.detail } : {}) } }, { status: e.status, headers: { "Cache-Control": "no-store" } });
  }
  if (e instanceof ConfigError) {
    console.error("[http] Configuração do servidor inválida:", e.message);
    return NextResponse.json({ ok: false, erro: { codigo: "CONFIGURACAO_SERVIDOR", mensagem: "O servidor do painel está sem configuração válida." } }, { status: 500 });
  }
  console.error("[http] Erro inesperado:", e);
  return NextResponse.json({ ok: false, erro: { codigo: "ERRO_INTERNO", mensagem: "Erro inesperado no servidor do painel." } }, { status: 500 });
}

export async function currentUser(): Promise<SessionUser | null> {
  const cfg = getConfig();
  const jar = await cookies();
  const payload = readSessionToken(jar.get(SESSION_COOKIE)?.value, cfg.sessionSecret);
  return resolveSessionUser(payload, cfg.usuarios);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new PainelError("SESSAO_AUSENTE", "Sessão expirada ou inexistente. Entre novamente.", 401);
  return user;
}

export function requireEditor(user: SessionUser): void {
  if (!podeDecidir(user)) {
    throw new PainelError("NAO_AUTORIZADO", "Este usuário não tem permissão para editar ou decidir.", 403);
  }
}

/**
 * Proteção contra requisições de outros sites em mutações: exige o cabeçalho
 * personalizado (força preflight) e, quando presente, Origin igual ao host.
 */
export function assertSameOrigin(req: NextRequest): void {
  if (req.headers.get("x-painel-requisicao") !== "1") {
    throw new PainelError("ORIGEM_RECUSADA", "Requisição recusada (cabeçalho do painel ausente).", 403);
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    if (!host || originHost !== host) throw new PainelError("ORIGEM_RECUSADA", "Requisição recusada (origem diferente do painel).", 403);
  }
}

export async function readJson(req: NextRequest, maxBytes = 512 * 1024): Promise<unknown> {
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new PainelError("CORPO_GRANDE", "Conteúdo maior que o permitido.", 413);
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new PainelError("JSON_INVALIDO", "Corpo da requisição não é JSON válido.", 400);
  }
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
