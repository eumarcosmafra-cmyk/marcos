import { createHmac, timingSafeEqual } from "node:crypto";
import type { UsuarioConfig } from "../config";

/**
 * Sessão em cookie assinado (HMAC-SHA256). O cookie guarda apenas o login e a
 * validade; papel, ator_id e cliente_id são relidos da configuração do servidor
 * a cada requisição — desativar um usuário vale na hora.
 */

export const SESSION_COOKIE = "painel_sessao";

interface SessionPayload {
  u: string;
  iat: number;
  exp: number;
}

function sign(data: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(usuario: string, secret: Buffer, ttlSeconds: number, now = Date.now()): string {
  const payload: SessionPayload = { u: usuario, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + ttlSeconds };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function readSessionToken(token: string | undefined, secret: Buffer, now = Date.now()): SessionPayload | null {
  if (!token || token.length > 1024) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data, secret));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.u !== "string" || typeof payload.exp !== "number" || typeof payload.iat !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export interface SessionUser {
  usuario: string;
  nome: string;
  ator_id: string;
  papel: UsuarioConfig["papel"];
  cliente_id: string;
  ambientes: UsuarioConfig["ambientes"];
}

export function resolveSessionUser(payload: SessionPayload | null, usuarios: UsuarioConfig[]): SessionUser | null {
  if (!payload) return null;
  const u = usuarios.find((x) => x.usuario === payload.u && x.ativo);
  if (!u) return null;
  return { usuario: u.usuario, nome: u.nome, ator_id: u.ator_id, papel: u.papel, cliente_id: u.cliente_id, ambientes: u.ambientes };
}

export function podeDecidir(user: SessionUser): boolean {
  return user.papel === "editor_responsavel";
}
