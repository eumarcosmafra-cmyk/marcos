import { trackedQueryRepository } from "@/repositories/tracked-query-repository";
import { rankingRepository } from "@/repositories/ranking-repository";
import { serpRepository } from "@/repositories/serp-repository";
import type { JobResult } from "./sync-serp-mapper";

export async function syncRankingHistory(): Promise<JobResult> {
  const queries = await trackedQueryRepository.findAllActive();
  const result: JobResult = {
    totalProcessed: queries.length,
    successCount: 0,
    failCount: 0,
    errors: [],
  };

  for (const query of queries) {
    try {
      const snapshot = await serpRepository.getLatestSnapshot(query.id);
      if (!snapshot) {
        result.successCount++;
        continue;
      }

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
    `[sync-ranking] Done: ${result.successCount}/${result.totalProcessed} ok, ${result.failCount} failed`
  );
  return result;
}
