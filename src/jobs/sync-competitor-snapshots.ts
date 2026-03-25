import { competitorRepository } from "@/repositories/competitor-repository";
import { fetchPageSnapshot } from "@/services/competitors/fetch-page-snapshot";
import { detectPageChanges } from "@/services/competitors/detect-page-changes";
import {
  buildRecommendedActionForCompetitorChange,
} from "@/services/alerts/build-recommended-action";
import { buildAlert } from "@/services/alerts/build-alert";
import type { JobResult } from "./sync-serp-mapper";

export async function syncCompetitorSnapshots(): Promise<
  JobResult & { alertsCreated: number }
> {
  const competitors = await competitorRepository.findAllMonitored();
  const result = {
    totalProcessed: competitors.length,
    successCount: 0,
    failCount: 0,
    errors: [] as string[],
    alertsCreated: 0,
  };

  for (const comp of competitors) {
    try {
      const snapshotData = await fetchPageSnapshot(comp.url);
      if (!snapshotData.rawHtmlHash) {
        result.successCount++;
        continue;
      }

      // Get previous snapshot
      const previousSnapshot = comp.snapshots[0] || null;

      // Save new snapshot
      await competitorRepository.createSnapshot(comp.id, snapshotData);

      // Detect changes
      if (previousSnapshot) {
        const changes = detectPageChanges(previousSnapshot, snapshotData);

        if (changes.length > 0) {
          const recommendedAction =
            buildRecommendedActionForCompetitorChange(changes);

          await buildAlert({
            clientId: comp.trackedQuery.categoryWatch.client.id,
            categoryWatchId: comp.trackedQuery.categoryWatch.id,
            trackedQueryId: comp.trackedQuery.id,
            severity: "INFO",
            type: "COMPETITOR_UPDATE",
            title: `Concorrente ${comp.domain} atualizou página`,
            message: changes.map((c) => c.description).join("; "),
            recommendedAction,
            metadata: { changes, competitorUrl: comp.url },
          });

          result.alertsCreated++;
        }
      }

      result.successCount++;
    } catch (error) {
      result.failCount++;
      result.errors.push(
        `${comp.url}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  console.log(
    `[sync-competitors] Done: ${result.successCount}/${result.totalProcessed} ok, ${result.failCount} failed, ${result.alertsCreated} alerts`
  );
  return result;
}
