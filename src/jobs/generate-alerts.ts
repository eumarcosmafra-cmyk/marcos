import { trackedQueryRepository } from "@/repositories/tracked-query-repository";
import { detectSerpMovements } from "@/services/serp/detect-serp-movement";
import { detectRankingDrop } from "@/services/ranking/detect-ranking-drop";
import {
  buildRecommendedActionForDrop,
  buildRecommendedActionForSerpMovement,
} from "@/services/alerts/build-recommended-action";
import { buildAlert } from "@/services/alerts/build-alert";
import type { JobResult } from "./sync-serp-mapper";

export async function generateAlerts(): Promise<
  JobResult & { alertsCreated: number }
> {
  const queries = await trackedQueryRepository.findAllPrimary();
  const result = {
    totalProcessed: queries.length,
    successCount: 0,
    failCount: 0,
    errors: [] as string[],
    alertsCreated: 0,
  };

  for (const query of queries) {
    try {
      const clientDomain = query.categoryWatch.client.domain;

      // 1. Detect SERP movements
      const movements = await detectSerpMovements(query.id, clientDomain);
      for (const movement of movements) {
        const severity =
          movement.type === "OUR_DOMAIN_OUT" || movement.type === "LEADER_CHANGE"
            ? "CRITICAL"
            : "WARNING";

        const alertType =
          movement.type === "NEW_TOP5"
            ? "NEW_TOP5_COMPETITOR"
            : "SERP_MOVEMENT";

        await buildAlert({
          clientId: query.categoryWatch.client.id,
          categoryWatchId: query.categoryWatch.id,
          trackedQueryId: query.id,
          severity,
          type: alertType,
          title: movement.description,
          message: `Query: "${query.query}" — ${movement.description}`,
          recommendedAction: buildRecommendedActionForSerpMovement(movement),
          metadata: movement,
        });
        result.alertsCreated++;
      }

      // 2. Detect ranking drops
      const drop = await detectRankingDrop(query.id);
      if (drop.severity) {
        await buildAlert({
          clientId: query.categoryWatch.client.id,
          categoryWatchId: query.categoryWatch.id,
          trackedQueryId: query.id,
          severity: drop.severity,
          type: "RANKING_DROP",
          title: `Queda de posição: ${drop.startPosition} → ${drop.currentPosition}`,
          message: `Query "${query.query}" caiu ${drop.totalDrop} posições em ${drop.daysDropping} dias`,
          recommendedAction: buildRecommendedActionForDrop(drop.currentPosition),
          metadata: drop,
        });
        result.alertsCreated++;
      }

      result.successCount++;
    } catch (error) {
      result.failCount++;
      result.errors.push(
        `Query "${query.query}": ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  console.log(
    `[generate-alerts] Done: ${result.successCount}/${result.totalProcessed} ok, ${result.failCount} failed, ${result.alertsCreated} alerts`
  );
  return result;
}
