import crypto from "crypto";

export interface PageSnapshotData {
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  contentLength: number;
  faqCount: number;
  rawHtmlHash: string;
}

export async function fetchPageSnapshot(url: string): Promise<PageSnapshotData> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SEOMonitorBot/1.0; +https://seomonitor.local)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    return parseHtml(html);
  } catch (error) {
    console.warn(`[snapshot] Failed to fetch ${url}:`, error);
    return {
      title: null,
      h1: null,
      metaDescription: null,
      contentLength: 0,
      faqCount: 0,
      rawHtmlHash: "",
    };
  }
}

function parseHtml(html: string): PageSnapshotData {
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = extractTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const metaDesc = extractMetaDescription(html);

  // Strip HTML tags for content length
  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const contentLength = textContent.length;

  // Count FAQ-like patterns
  const faqPatterns = [
    /<details/gi,
    /itemtype="https?:\/\/schema\.org\/FAQPage"/gi,
    /class="[^"]*faq[^"]*"/gi,
    /<h[2-4][^>]*>\s*(como|o que|por que|quando|qual|quais|onde|quanto)/gi,
  ];
  const faqCount = faqPatterns.reduce((count, pattern) => {
    const matches = html.match(pattern);
    return count + (matches?.length || 0);
  }, 0);

  const rawHtmlHash = crypto.createHash("md5").update(html).digest("hex");

  return { title, h1, metaDescription: metaDesc, contentLength, faqCount, rawHtmlHash };
}

function extractTag(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  return match[1].replace(/<[^>]+>/g, "").trim().slice(0, 500);
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i
  );
  return match?.[1]?.trim().slice(0, 500) || null;
}
