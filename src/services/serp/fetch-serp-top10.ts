import { getEnv, hasSerpApi } from "@/lib/env";

export interface SerpOrganicResult {
  position: number;
  title: string;
  link: string;
  domain: string;
  snippet?: string;
}

export interface SerpResponse {
  results: SerpOrganicResult[];
  rawJson: unknown;
}

/**
 * Fetch top 10 organic SERP results for a query.
 * Uses Serper.dev API by default. Adapter pattern for easy swap.
 */
export async function fetchSerpTop10(
  query: string,
  location = "Brazil",
  language = "pt-br"
): Promise<SerpResponse> {
  if (!hasSerpApi()) {
    return getMockResults(query);
  }

  const env = getEnv();
  const provider = env.SERP_API_PROVIDER || "serper";

  switch (provider) {
    case "serper":
      return fetchFromSerper(query, location, language, env.SERP_API_KEY);
    default:
      throw new Error(`Unknown SERP provider: ${provider}`);
  }
}

async function fetchFromSerper(
  query: string,
  location: string,
  language: string,
  apiKey: string
): Promise<SerpResponse> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "br",
      hl: language,
      num: 10,
      type: "search",
      engine: "google",
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const organic = (data.organic || []) as {
    position?: number;
    title?: string;
    link?: string;
    domain?: string;
    snippet?: string;
  }[];

  const results: SerpOrganicResult[] = organic.slice(0, 10).map((r, i) => ({
    position: r.position || i + 1,
    title: r.title || "",
    link: r.link || "",
    domain: r.domain || extractDomain(r.link || ""),
    snippet: r.snippet,
  }));

  return { results, rawJson: data };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function getMockResults(query: string): SerpResponse {
  const results: SerpOrganicResult[] = Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    title: `Resultado ${i + 1} para "${query}"`,
    link: `https://example${i + 1}.com/${query.replace(/\s/g, "-")}`,
    domain: `example${i + 1}.com`,
    snippet: `Snippet mock para ${query} posição ${i + 1}`,
  }));

  return { results, rawJson: { mock: true, query } };
}
