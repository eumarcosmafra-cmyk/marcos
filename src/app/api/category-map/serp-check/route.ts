import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnv, hasSerpApi } from "@/lib/env";

const schema = z.object({
  query: z.string().min(1),
  targetUrl: z.string().min(1),
});

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").toLowerCase();
  }
}

/** Strip query params and trailing slash, lowercase */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, "").toLowerCase();
  } catch {
    return url.replace(/\?.*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { query, targetUrl } = parsed.data;

    if (!hasSerpApi()) {
      return NextResponse.json({ error: "SERP API not configured" }, { status: 400 });
    }

    const env = getEnv();

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": env.SERP_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "br",
        hl: "pt-br",
        num: 100,
        type: "search",
        engine: "google",
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Serper error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const organic = (data.organic || []) as {
      position?: number;
      link?: string;
      domain?: string;
      title?: string;
      snippet?: string;
    }[];

    const targetDomain = normalizeDomain(targetUrl);
    const targetNorm = normalizeUrl(targetUrl);

    // Build top 10 for display
    const top10 = organic.slice(0, 10).map((r) => ({
      position: r.position || 0,
      domain: r.domain || normalizeDomain(r.link || ""),
      title: r.title || "",
      url: r.link || "",
    }));

    // 1. Exact URL match (ignoring query params)
    const exactMatch = organic.find((r) => normalizeUrl(r.link || "") === targetNorm);

    if (exactMatch) {
      return NextResponse.json({
        position: exactMatch.position,
        match: "exact",
        url: exactMatch.link,
        title: exactMatch.title,
        top10,
      });
    }

    // 2. Path-contains match (target path is inside the result URL or vice versa)
    const targetPath = new URL(targetUrl).pathname.replace(/\/$/, "").toLowerCase();
    const pathMatch = organic.find((r) => {
      try {
        const rPath = new URL(r.link || "").pathname.replace(/\/$/, "").toLowerCase();
        const rDomain = normalizeDomain(r.link || "");
        return rDomain === targetDomain && (rPath === targetPath || rPath.startsWith(targetPath));
      } catch {
        return false;
      }
    });

    if (pathMatch) {
      return NextResponse.json({
        position: pathMatch.position,
        match: "path",
        url: pathMatch.link,
        title: pathMatch.title,
        top10,
      });
    }

    // 3. Domain match (any page from same domain)
    const domainMatch = organic.find((r) => {
      const rDomain = normalizeDomain(r.link || "");
      return rDomain === targetDomain;
    });

    if (domainMatch) {
      return NextResponse.json({
        position: domainMatch.position,
        match: "domain",
        url: domainMatch.link,
        title: domainMatch.title,
        top10,
      });
    }

    // Not found
    return NextResponse.json({
      position: null,
      match: null,
      top10,
    });
  } catch (error) {
    console.error("[serp-check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
