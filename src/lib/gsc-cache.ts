// TODO: migrate to Upstash Redis — see fixes-spec-final.md Step 12
// Current in-memory cache does not persist across Vercel serverless instances.
// When UPSTASH_REDIS_REST_URL is configured, replace with async Redis version.

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const TTL = 15 * 60 * 1000; // 15 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(keyPrefix?: string): void {
  if (keyPrefix) {
    for (const key of cache.keys()) {
      if (key.startsWith(keyPrefix)) cache.delete(key);
    }
  } else {
    cache.clear();
  }
}
