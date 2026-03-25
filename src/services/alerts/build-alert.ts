import { alertRepository } from "@/repositories/alert-repository";
import type { AlertSeverity, AlertType } from "@prisma/client";

export interface AlertInput {
  clientId: string;
  categoryWatchId?: string;
  trackedQueryId?: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string;
  recommendedAction?: string;
  metadata?: unknown;
}

export async function buildAlert(input: AlertInput) {
  return alertRepository.create({
    clientId: input.clientId,
    categoryWatchId: input.categoryWatchId,
    trackedQueryId: input.trackedQueryId,
    severity: input.severity,
    type: input.type,
    title: input.title,
    message: input.message,
    recommendedAction: input.recommendedAction,
    metadataJson: input.metadata,
  });
}
