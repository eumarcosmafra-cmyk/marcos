import { alertRepository } from "@/repositories/alert-repository";
import { actionQueueRepository } from "@/repositories/action-queue-repository";
import { rankingRepository } from "@/repositories/ranking-repository";
import type { PriorityLabel } from "@prisma/client";
import type { JobResult } from "./sync-serp-mapper";

export async function generateActionQueue(): Promise<
  JobResult & { actionsCreated: number }
> {
  const openAlerts = await alertRepository.findOpenAlerts();
  const result = {
    totalProcessed: openAlerts.length,
    successCount: 0,
    failCount: 0,
    errors: [] as string[],
    actionsCreated: 0,
  };

  for (const alert of openAlerts) {
    try {
      if (!alert.recommendedAction) {
        result.successCount++;
        continue;
      }

      // Calculate priority score
      const impact = getImpactScore(alert.type, alert.severity);
      const opportunity = await getOpportunityScore(alert.trackedQueryId);
      const urgency = getUrgencyScore(alert.severity);

      const priorityScore = impact * opportunity * urgency;
      const priorityLabel = getPriorityLabel(priorityScore);

      await actionQueueRepository.create({
        clientId: alert.clientId,
        categoryWatchId: alert.categoryWatchId ?? undefined,
        trackedQueryId: alert.trackedQueryId ?? undefined,
        priorityScore,
        priorityLabel,
        actionType: alert.type,
        actionTitle: alert.title,
        actionDescription: alert.recommendedAction,
        source: `Alert: ${alert.id}`,
      });

      result.actionsCreated++;
      result.successCount++;
    } catch (error) {
      result.failCount++;
      result.errors.push(
        `Alert ${alert.id}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  console.log(
    `[action-queue] Done: ${result.successCount}/${result.totalProcessed} ok, ${result.failCount} failed, ${result.actionsCreated} actions`
  );
  return result;
}

function getImpactScore(
  type: string,
  severity: string
): number {
  if (severity === "CRITICAL") {
    if (type === "RANKING_DROP") return 10;
    if (type === "SERP_MOVEMENT") return 9;
    return 8;
  }
  if (type === "NEW_TOP5_COMPETITOR") return 8;
  if (type === "RANKING_DROP") return 7;
  if (type === "COMPETITOR_UPDATE") return 5;
  return 4;
}

async function getOpportunityScore(
  trackedQueryId: string | null
): Promise<number> {
  if (!trackedQueryId) return 5;
  const latest = await rankingRepository.getLatest(trackedQueryId);
  if (!latest?.yourPosition) return 5;

  // Better position = higher opportunity
  if (latest.yourPosition <= 10) return 9;
  if (latest.yourPosition <= 20) return 8;
  return 5;
}

function getUrgencyScore(severity: string): number {
  switch (severity) {
    case "CRITICAL":
      return 10;
    case "WARNING":
      return 6;
    default:
      return 3;
  }
}

function getPriorityLabel(score: number): PriorityLabel {
  if (score >= 200) return "HIGH";
  if (score >= 80) return "MEDIUM";
  return "LOW";
}
