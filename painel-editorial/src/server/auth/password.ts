import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash de senha com scrypt (Node, sem dependências externas).
 * Formato: scrypt$N$r$p$<salt base64url>$<hash base64url>
 */

const KEYLEN = 64;
const DEFAULT = { N: 1 << 15, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string, params = DEFAULT): Promise<string> {
  if (password.length < 12) throw new Error("A senha precisa ter ao menos 12 caracteres.");
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { ...params, maxmem: 256 * params.N * params.r });
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (!Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P) || N < 1024 || N > 1 << 20) return false;
  const expected = Buffer.from(hashB64, "base64url");
  if (expected.length < 32) return false;
  try {
    const key = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, {
      N,
      r: R,
      p: P,
      maxmem: 256 * N * R,
    });
    return timingSafeEqual(key, expected);
  } catch (e) {
    console.error("[password] Falha ao verificar hash:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Hash fixo usado para equalizar o tempo de resposta quando o usuário não existe. */
export const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
