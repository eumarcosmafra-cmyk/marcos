/**
 * Limite de tentativas de login por IP+usuário.
 *
 * Em memória do processo: suficiente para uma única instância do painel na VPS
 * (é o caso desta implantação). Com mais de uma instância, mover para um
 * armazenamento compartilhado.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; first: number }>();

export function loginBlocked(key: string, now = Date.now()): { blocked: boolean; retryAfterSeconds: number } {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) return { blocked: false, retryAfterSeconds: 0 };
  if (entry.count >= MAX_ATTEMPTS) return { blocked: true, retryAfterSeconds: Math.ceil((entry.first + WINDOW_MS - now) / 1000) };
  return { blocked: false, retryAfterSeconds: 0 };
}

export function registerFailure(key: string, now = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
  else entry.count += 1;
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
  }
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
