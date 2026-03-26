import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackedQueryRepository } from "@/repositories/tracked-query-repository";
import { categoryWatchRepository } from "@/repositories/category-watch-repository";
import { mapSerpResults } from "@/services/serp/map-serp-results";

const selectQuerySchema = z.object({
  categoryWatchId: z.string().optional(),
  clientId: z.string().optional(),
  categoryName: z.string().optional(),
  targetUrl: z.string().optional(),
  primaryQuery: z.string().min(1),
  relatedQueries: z.array(z.string().min(1)).max(5).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = selectQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryWatchId, clientId, categoryName, targetUrl, primaryQuery, relatedQueries } = parsed.data;

    // Find or create category
    let catId = categoryWatchId;
    if (!catId && clientId && categoryName && targetUrl) {
      // Check limit
      const count = await categoryWatchRepository.countByClient(clientId);
      if (count >= 5) {
        return NextResponse.json(
          { error: "Limite de 5 categorias por cliente atingido" },
          { status: 400 }
        );
      }
      const newCat = await categoryWatchRepository.create(clientId, categoryName, targetUrl);
      catId = newCat.id;
    }

    if (!catId) {
      return NextResponse.json({ error: "categoryWatchId or clientId+categoryName+targetUrl required" }, { status: 400 });
    }

    const category = await categoryWatchRepository.findById(catId);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Save query cluster
    const cluster = await trackedQueryRepository.upsertCluster(
      catId,
      primaryQuery,
      relatedQueries
    );

    // Trigger initial SERP mapping for primary query
    let serpSnapshot = null;
    try {
      serpSnapshot = await mapSerpResults(cluster.primary.id, primaryQuery);
    } catch (e) {
      console.warn("[select-query] Initial SERP map failed:", e);
    }

    return NextResponse.json({
      cluster,
      serpSnapshot: serpSnapshot
        ? {
            id: serpSnapshot.id,
            results: serpSnapshot.results.map((r) => ({
              position: r.position,
              domain: r.domain,
              url: r.url,
              title: r.title,
              isMonitored: r.isMonitored,
            })),
          }
        : null,
    });
  } catch (error) {
    console.error("[category-watch/select-query] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
