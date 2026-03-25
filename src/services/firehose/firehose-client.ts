/**
 * Ahrefs Firehose API Client
 * https://firehose.com/api-docs
 *
 * - Management Key (fhm_): manage taps
 * - Tap Token (fh_): manage rules + stream
 */

const FIREHOSE_BASE = "https://api.firehose.com/v1";

// ─── Tap Management (requires Management Key) ─────────────────

export interface FirehoseTap {
  id: string;
  name: string;
  token_prefix: string;
  token?: string;
}

export async function listTaps(managementKey: string): Promise<FirehoseTap[]> {
  const res = await fetch(`${FIREHOSE_BASE}/taps`, {
    headers: { Authorization: `Bearer ${managementKey}` },
  });
  if (!res.ok) throw new Error(`Firehose listTaps: ${res.status}`);
  const data = await res.json();
  return data.taps || data;
}

export async function createTap(
  managementKey: string,
  name: string
): Promise<FirehoseTap> {
  const res = await fetch(`${FIREHOSE_BASE}/taps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Firehose createTap: ${res.status}`);
  return res.json();
}

export async function deleteTap(
  managementKey: string,
  tapId: string
): Promise<void> {
  const res = await fetch(`${FIREHOSE_BASE}/taps/${tapId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${managementKey}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Firehose deleteTap: ${res.status}`);
  }
}

// ─── Rule Management (requires Tap Token) ──────────────────────

export interface FirehoseRule {
  id: string;
  value: string;
  tag: string;
}

export async function listRules(tapToken: string): Promise<FirehoseRule[]> {
  const res = await fetch(`${FIREHOSE_BASE}/rules`, {
    headers: { Authorization: `Bearer ${tapToken}` },
  });
  if (!res.ok) throw new Error(`Firehose listRules: ${res.status}`);
  const data = await res.json();
  return data.rules || data;
}

export async function createRule(
  tapToken: string,
  value: string,
  tag: string
): Promise<FirehoseRule> {
  const res = await fetch(`${FIREHOSE_BASE}/rules`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tapToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value, tag }),
  });
  if (!res.ok) throw new Error(`Firehose createRule: ${res.status}`);
  return res.json();
}

export async function deleteRule(
  tapToken: string,
  ruleId: string
): Promise<void> {
  const res = await fetch(`${FIREHOSE_BASE}/rules/${ruleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tapToken}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Firehose deleteRule: ${res.status}`);
  }
}

// ─── Lucene Query Builders ─────────────────────────────────────

/**
 * Build a Lucene query to monitor a competitor domain.
 * Watches for title, content, or meta changes on that domain.
 */
export function buildDomainRule(domain: string): string {
  const clean = domain.replace(/^www\./, "").toLowerCase();
  return `domain:${clean}`;
}

/**
 * Build a Lucene query to monitor a specific URL path on a domain.
 */
export function buildUrlRule(url: string): string {
  try {
    const u = new URL(url);
    const domain = u.hostname.replace(/^www\./, "");
    const path = u.pathname;
    return `domain:${domain} AND url:*${path}*`;
  } catch {
    return `url:*${url}*`;
  }
}

/**
 * Build tag for a competitor rule (used to map events back to our system).
 * Format: "comp:{competitorPageId}"
 */
export function buildCompetitorTag(competitorPageId: string): string {
  return `comp:${competitorPageId}`;
}

/**
 * Parse a competitor tag back to competitorPageId.
 */
export function parseCompetitorTag(tag: string): string | null {
  if (tag.startsWith("comp:")) return tag.slice(5);
  return null;
}
