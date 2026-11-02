import "server-only";
import { z } from "zod";

/**
 * Configuração do servidor do painel. Lida SOMENTE no servidor; nada daqui vai
 * para o navegador. Segredos (segredo de sessão, token do adaptador, hashes de
 * senha) vêm de variáveis de ambiente definidas na VPS.
 */

export const PAPEIS = ["editor_responsavel", "leitor"] as const;
export type Papel = (typeof PAPEIS)[number];

const usuarioSchema = z.object({
  usuario: z.string().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  nome: z.string().min(1).max(80),
  ator_id: z.string().min(3).max(60).regex(/^[a-z0-9_]+$/),
  papel: z.enum(PAPEIS),
  cliente_id: z.string().min(3).max(80).regex(/^[a-z0-9_]+$/),
  senha_hash: z.string().startsWith("scrypt$"),
  ativo: z.boolean().default(true),
  /** Ambientes que o usuário pode ver. */
  ambientes: z.array(z.enum(["producao", "teste"])).min(1).default(["producao", "teste"]),
});

export type UsuarioConfig = z.infer<typeof usuarioSchema>;

export interface ServerConfig {
  sessionSecret: Buffer;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  usuarios: UsuarioConfig[];
  adapterUrl: string;
  adapterToken: string;
  adapterTimeoutMs: number;
  commit: string;
}

let cached: ServerConfig | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const secret = env.PAINEL_SESSION_SECRET ?? "";
  if (Buffer.byteLength(secret) < 32) {
    throw new ConfigError("PAINEL_SESSION_SECRET ausente ou com menos de 32 caracteres.");
  }
  // PAINEL_USUARIOS_B64 (JSON em base64) evita problemas de aspas em arquivos .env.
  const rawUsers = env.PAINEL_USUARIOS_B64
    ? Buffer.from(env.PAINEL_USUARIOS_B64, "base64").toString("utf8")
    : (env.PAINEL_USUARIOS_JSON ?? "");
  let parsedUsers: unknown;
  try {
    parsedUsers = JSON.parse(rawUsers || "[]");
  } catch (e) {
    console.error("[config] Lista de usuários inválida:", e instanceof Error ? e.message : e);
    throw new ConfigError("PAINEL_USUARIOS_B64/PAINEL_USUARIOS_JSON não contém JSON válido.");
  }
  const users = z.array(usuarioSchema).safeParse(parsedUsers);
  if (!users.success) {
    throw new ConfigError(`Lista de usuários fora do formato: ${users.error.issues[0]?.path.join(".")} ${users.error.issues[0]?.message}`);
  }
  const names = new Set<string>();
  for (const u of users.data) {
    if (names.has(u.usuario)) throw new ConfigError(`Usuário duplicado: ${u.usuario}`);
    names.add(u.usuario);
  }
  const adapterUrl = env.N8N_ADAPTADOR_URL ?? "";
  if (!/^https?:\/\/[^/]+\/.+/.test(adapterUrl)) throw new ConfigError("N8N_ADAPTADOR_URL ausente ou inválida.");
  const adapterToken = env.N8N_ADAPTADOR_TOKEN ?? "";
  if (adapterToken.length < 32) throw new ConfigError("N8N_ADAPTADOR_TOKEN ausente ou curto demais (mínimo 32).");

  return {
    sessionSecret: Buffer.from(secret),
    sessionTtlSeconds: Math.min(Math.max(Number(env.PAINEL_SESSAO_HORAS ?? 12), 1), 72) * 3600,
    cookieSecure: env.PAINEL_COOKIE_SECURE === "true",
    usuarios: users.data,
    adapterUrl,
    adapterToken,
    adapterTimeoutMs: Math.min(Math.max(Number(env.N8N_ADAPTADOR_TIMEOUT_MS ?? 45000), 2000), 120000),
    commit: env.PAINEL_COMMIT ?? "desconhecido",
  };
}

export function getConfig(): ServerConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Somente para testes. */
export function resetConfigForTests(): void {
  cached = null;
}
