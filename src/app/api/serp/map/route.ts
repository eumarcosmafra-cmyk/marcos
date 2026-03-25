import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackedQueryRepository } from "@/repositories/tracked-query-repository";
import { mapSerpResults } from "@/services/serp/map-serp-results";

const mapSchema = z.object({
  trackedQueryId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = mapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const query = await trackedQueryRepository.findById(parsed.data.trackedQueryId);
    if (!query) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }

    const snapshot = await mapSerpResults(query.id, query.query);

    return NextResponse.json({
      snapshot: {
        id: snapshot.id,
        checkedAt: snapshot.checkedAt,
        results: snapshot.results
          .filter((r) => r.isMonitored)
          .map((r) => ({
            position: r.position,
            domain: r.domain,
            url: r.url,
            title: r.title,
          })),
      },
      totalResults: snapshot.results.length,
      monitoredCount: snapshot.results.filter((r) => r.isMonitored).length,
    });
  } catch (error) {
    console.error("[serp/map] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
