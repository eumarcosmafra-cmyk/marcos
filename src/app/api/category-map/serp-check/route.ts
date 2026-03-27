import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnv, hasSerpApi } from "@/lib/env";

const schema = z.object({
  query: z.string().min(1),
  targetUrl: z.string().min(1),
});

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
        location: "Brazil",
        num: 30,
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
    }[];

    // Extract target domain for matching
    let targetDomain = "";
    try {
      targetDomain = new URL(targetUrl).hostname.replace(/^www\./, "").toLowerCase();
    } catch {}

    const targetNorm = targetUrl.replace(/\/$/, "").toLowerCase();

    // Find exact URL match first
    const exactMatch = organic.find(
      (r) => (r.link || "").replace(/\/$/, "").toLowerCase() === targetNorm
    );

    if (exactMatch) {
      return NextResponse.json({
        position: exactMatch.position,
        match: "exact",
        url: exactMatch.link,
        title: exactMatch.title,
        top5: organic.slice(0, 5).map((r, i) => ({
          position: r.position || i + 1,
          domain: r.domain || "",
          title: r.title || "",
          url: r.link || "",
        })),
      });
    }

    // Try domain match
    const domainMatch = organic.find(
      (r) => (r.domain || "").replace(/^www\./, "").toLowerCase() === targetDomain
    );

    if (domainMatch) {
      return NextResponse.json({
        position: domainMatch.position,
        match: "domain",
        url: domainMatch.link,
        title: domainMatch.title,
        top5: organic.slice(0, 5).map((r, i) => ({
          position: r.position || i + 1,
          domain: r.domain || "",
          title: r.title || "",
          url: r.link || "",
        })),
      });
    }

    // Not found in top 30
    return NextResponse.json({
      position: null,
      match: null,
      top5: organic.slice(0, 5).map((r, i) => ({
        position: r.position || i + 1,
        domain: r.domain || "",
        title: r.title || "",
        url: r.link || "",
      })),
    });
  } catch (error) {
    console.error("[category-map/serp-check] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
