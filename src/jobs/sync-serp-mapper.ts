import { trackedQueryRepository } from "@/repositories/tracked-query-repository";
import { rankingRepository } from "@/repositories/ranking-repository";
import { mapSerpResults } from "@/services/serp/map-serp-results";

export interface JobResult {
  totalProcessed: number;
  successCount: number;
  failCount: number;
  errors: string[];
}

export async function syncSerpMapper(): Promise<JobResult> {
  const queries = await trackedQueryRepository.findAllPrimary();
  const result: JobResult = {
    totalProcessed: queries.length,
    successCount: 0,
    failCount: 0,
    errors: [],
  };

  for (const query of queries) {
    try {
      const snapshot = await mapSerpResults(query.id, query.query);

      // Find our position in results
      const clientDomain = query.categoryWatch.client.domain
        .replace(/^www\./, "")
        .toLowerCase();

      const ourResult = snapshot.results.find((r) =>
        r.domain.toLowerCase().includes(clientDomain)
      );

      const topCompetitor = snapshot.results.find(
        (r) => !r.domain.toLowerCase().includes(clientDomain)
      );

      await rankingRepository.create({
        trackedQueryId: query.id,
        yourPosition: ourResult?.position ?? null,
        yourUrl: ourResult?.url ?? null,
        topCompetitorDomain: topCompetitor?.domain ?? null,
      });

      result.successCount++;
    } catch (error) {
      result.failCount++;
      result.errors.push(
        `Query "${query.query}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  console.log(
    `[sync-serp] Done: ${result.successCount}/${result.totalProcessed} ok, ${result.failCount} failed`
  );
  return result;
}
