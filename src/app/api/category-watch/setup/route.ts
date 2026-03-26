import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { categoryWatchRepository } from "@/repositories/category-watch-repository";
import { clientRepository } from "@/repositories/client-repository";
import { getEnv, hasSerpApi } from "@/lib/env";

const setupSchema = z.object({
  clientId: z.string().optional(),
  categoryName: z.string().min(1).max(100),
  targetUrl: z.string().url(),
});

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface SerperRelatedSearch {
  query: string;
}

async function fetchRelatedQueries(
  categoryName: string,
  apiKey: string
): Promise<{ query: string; impressions: number; position: number; relevanceScore: number }[]> {
  // Search for the category name to get related searches and "people also ask"
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: categoryName,
      gl: "br",
      hl: "pt-br",
      location: "Brazil",
      num: 10,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status}`);
  }

  const data = await res.json();

  const queries: { query: string; impressions: number; position: number; relevanceScore: number }[] = [];

  // Add the main query
  queries.push({
    query: categoryName,
    impressions: 1000,
    position: 1,
    relevanceScore: 1.0,
  });

  // Add related searches from Serper
  const relatedSearches = (data.relatedSearches || []) as SerperRelatedSearch[];
  relatedSearches.forEach((rs: SerperRelatedSearch, i: number) => {
    queries.push({
      query: rs.query,
      impressions: Math.max(100, 800 - i * 80),
      position: i + 2,
      relevanceScore: Math.max(0.3, 1.0 - i * 0.08),
    });
  });

  // Add "people also ask" questions
  const peopleAlsoAsk = (data.peopleAlsoAsk || []) as { question: string }[];
  peopleAlsoAsk.forEach((paa: { question: string }, i: number) => {
    queries.push({
      query: paa.question,
      impressions: Math.max(50, 500 - i * 60),
      position: relatedSearches.length + i + 2,
      relevanceScore: Math.max(0.2, 0.8 - i * 0.1),
    });
  });

  return queries;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clientId, categoryName, targetUrl } = parsed.data;

    // Extract domain from targetUrl and auto-create client
    const domain = extractDomain(targetUrl);

    let client = null;

    // Try finding by provided ID first
    if (clientId) {
      client = await clientRepository.findById(clientId);
    }

    // Try finding by domain
    if (!client) {
      client = await clientRepository.findByDomain(domain);
    }

    // Auto-create from domain
    if (!client) {
      client = await clientRepository.upsertByDomain(domain, domain);
    }

    // Check limit of 5 categories per client
    const count = await categoryWatchRepository.countByClient(client.id);
    if (count >= 5) {
      return NextResponse.json(
        { error: "Limite de 5 categorias por cliente atingido" },
        { status: 400 }
      );
    }

    // Create category watch
    const categoryWatch = await categoryWatchRepository.create(
      client.id,
      categoryName,
      targetUrl
    );

    // Fetch related queries from Google via Serper API
    let suggestedQueries: { query: string; impressions: number; position: number; relevanceScore: number }[] = [];
    if (hasSerpApi()) {
      try {
        const env = getEnv();
        suggestedQueries = await fetchRelatedQueries(categoryName, env.SERP_API_KEY);
      } catch (e) {
        console.warn("[setup] Serper query failed:", e);
        // Return at least the category name as a query
        suggestedQueries = [{
          query: categoryName,
          impressions: 0,
          position: 0,
          relevanceScore: 1.0,
        }];
      }
    } else {
      // No API key — return category name as fallback
      suggestedQueries = [{
        query: categoryName,
        impressions: 0,
        position: 0,
        relevanceScore: 1.0,
      }];
    }

    return NextResponse.json({
      categoryWatch,
      suggestedQueries,
    });
  } catch (error) {
    console.error("[category-watch/setup] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
