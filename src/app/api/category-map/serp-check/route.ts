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

    const requestBody = {
      q: query,
      gl: "br",
      hl: "pt-br",
      num: 30,
      type: "search",
      engine: "google",
    };

    console.log("[serp-check] Request:", JSON.stringify(requestBody));

    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": env.SERP_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[serp-check] Serper error:", res.status, errorText);
      return NextResponse.json({ error: `Serper error: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    console.log("[serp-check] Query:", query, "Results:", (data.organic || []).length, "First:", (data.organic?.[0]?.title || "none"));
    const rawOrganic = (data.organic || []) as {
      position?: number;
      link?: string;
      domain?: string;
      title?: string;
      snippet?: string;
    }[];

    // Filter out social media / non-website results
    const socialDomains = [
      "instagram.com", "youtube.com", "tiktok.com", "facebook.com",
      "twitter.com", "x.com", "pinterest.com", "linkedin.com",
      "reddit.com", "quora.com",
    ];

    const organic = rawOrganic.filter((r) => {
      const domain = normalizeDomain(r.link || "");
      return !socialDomains.some((sd) => domain.includes(sd));
    });

    // Re-number positions after filtering
    const renumbered = organic.map((r, i) => ({ ...r, position: i + 1 }));

    const targetDomain = normalizeDomain(targetUrl);
    const targetNorm = targetUrl.replace(/\/$/, "").toLowerCase();

    // Build top 10 for display (filtered, only real websites)
    const top10 = renumbered.slice(0, 10).map((r) => ({
      position: r.position,
      domain: r.domain || normalizeDomain(r.link || ""),
      title: r.title || "",
      url: r.link || "",
    }));

    // Find exact URL match
    const exactMatch = renumbered.find((r) => {
      const link = (r.link || "").replace(/\/$/, "").toLowerCase();
      return link === targetNorm;
    });

    if (exactMatch) {
      return NextResponse.json({
        position: exactMatch.position,
        match: "exact",
        url: exactMatch.link,
        title: exactMatch.title,
        top10,
      });
    }

    // Domain match — normalize both sides
    const domainMatch = renumbered.find((r) => {
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

    // Partial domain match
    const partialMatch = renumbered.find((r) => {
      const rDomain = normalizeDomain(r.link || "");
      return rDomain.includes(targetDomain) || targetDomain.includes(rDomain);
    });

    if (partialMatch) {
      return NextResponse.json({
        position: partialMatch.position,
        match: "partial",
        url: partialMatch.link,
        title: partialMatch.title,
        top10,
      });
    }

    // Not found
    return NextResponse.json({
      position: null,
      match: null,
      top10,
      debug: { querySent: query, totalRaw: rawOrganic.length, totalFiltered: organic.length },
    });
  } catch (error) {
    console.error("[category-map/serp-check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
