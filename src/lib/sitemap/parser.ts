import type { SitemapUrl } from "@/types/category-map";

/**
 * Fetch and parse a sitemap XML, extracting all URLs.
 * Handles both regular sitemaps and sitemap indexes.
 */
export async function parseSitemap(sitemapUrl: string): Promise<SitemapUrl[]> {
  const response = await fetch(sitemapUrl, {
    headers: { "User-Agent": "SEO-Analyst-Bot/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`);
  }

  const xml = await response.text();

  // Check if it's a sitemap index
  if (xml.includes("<sitemapindex")) {
    return parseSitemapIndex(xml);
  }

  return parseUrlset(xml);
}

async function parseSitemapIndex(xml: string): Promise<SitemapUrl[]> {
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
  const sitemapUrls: string[] = [];
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    sitemapUrls.push(match[1].trim());
  }

  // Fetch each sub-sitemap (limit to first 5 to avoid overload)
  const results: SitemapUrl[] = [];
  for (const url of sitemapUrls.slice(0, 5)) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "SEO-Analyst-Bot/1.0" } });
      if (res.ok) {
        const subXml = await res.text();
        results.push(...parseUrlset(subXml));
      }
    } catch {}
  }

  return results;
}

function parseUrlset(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let blockMatch;

  while ((blockMatch = urlBlockRegex.exec(xml)) !== null) {
    const block = blockMatch[1];
    const loc = extractTag(block, "loc");
    if (!loc) continue;

    urls.push({
      loc: loc.trim(),
      lastmod: extractTag(block, "lastmod") || undefined,
      priority: extractTag(block, "priority") || undefined,
    });
  }

  return urls;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>\\s*(.*?)\\s*</${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

/**
 * Filter URLs to keep only likely category pages.
 * Heuristic: category pages typically have 1-3 path segments,
 * don't end with file extensions, and don't contain product-like patterns.
 */
export function filterCategoryUrls(urls: SitemapUrl[]): SitemapUrl[] {
  return urls.filter((u) => {
    try {
      const path = new URL(u.loc).pathname;

      // Skip homepage
      if (path === "/" || path === "") return false;

      // Skip files
      if (/\.(html|php|xml|json|jpg|png|pdf)$/i.test(path)) return false;

      // Skip known non-category patterns
      if (/\/(blog|post|article|news|tag|author|page|wp-|admin|cart|checkout|account|login)/i.test(path)) return false;

      // Skip product-like URLs (usually have long slugs with many hyphens or numeric IDs)
      const segments = path.split("/").filter(Boolean);
      if (segments.length > 3) return false;

      // Skip URLs with numeric IDs that look like products
      const lastSegment = segments[segments.length - 1] || "";
      if (/^\d+$/.test(lastSegment)) return false;
      if (/\d{5,}/.test(lastSegment)) return false;

      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Extract a human-readable name from a URL path segment.
 */
export function slugToName(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Determine depth and parent from URL structure.
 */
/**
 * Filter URLs to keep only likely product pages.
 * Product pages typically have deeper paths, specific slugs, or product-like patterns.
 */
/**
 * Filter URLs to keep only likely product pages.
 * Less aggressive than category filter — if the user provides a product sitemap,
 * we trust it and only skip obvious non-product pages.
 */
export function filterProductUrls(urls: SitemapUrl[]): SitemapUrl[] {
  return urls.filter((u) => {
    try {
      const path = new URL(u.loc).pathname;

      // Skip homepage
      if (path === "/" || path === "") return false;

      // Skip files
      if (/\.(xml|json|jpg|png|pdf)$/i.test(path)) return false;

      // Skip known non-product patterns
      if (/\/(blog|post|article|news|tag|author|page|wp-|admin|cart|checkout|account|login|sitemap|politica|termos|faq|contato|sobre)\b/i.test(path)) return false;

      // Accept everything else — the user provided a product sitemap, trust it
      return true;
    } catch {
      return false;
    }
  });
}

export function analyzeUrlStructure(url: string): { slug: string; depth: number; parentUrl: string | null } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    const depth = segments.length;

    let parentUrl: string | null = null;
    if (segments.length > 1) {
      parentUrl = `${parsed.origin}/${segments.slice(0, -1).join("/")}/`;
    }

    return { slug, depth, parentUrl };
  } catch {
    return { slug: url, depth: 0, parentUrl: null };
  }
}
