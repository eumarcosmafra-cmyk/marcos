import { prisma } from "@/lib/db";
import { competitorRepository } from "@/repositories/competitor-repository";
import { fetchPageSnapshot } from "@/services/competitors/fetch-page-snapshot";
import { detectPageChanges } from "@/services/competitors/detect-page-changes";
import { buildRecommendedActionForCompetitorChange } from "@/services/alerts/build-recommended-action";
import { buildAlert } from "@/services/alerts/build-alert";
import { parseCompetitorTag } from "./firehose-client";

export interface FirehoseEvent {
  url: string;
  domain: string;
  title?: string;
  added?: string;
  removed?: string;
  publish_time?: string;
  language?: string;
  page_category?: string;
}

export interface ProcessResult {
  processed: boolean;
  competitorPageId: string | null;
  changesDetected: number;
  alertCreated: boolean;
  error?: string;
}

/**
 * Process a single Firehose event.
 * Matches the event to a monitored competitor page, takes a snapshot,
 * detects changes, and creates alerts if needed.
 */
export async function processFirehoseEvent(
  event: FirehoseEvent,
  tag?: string
): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: false,
    competitorPageId: null,
    changesDetected: 0,
    alertCreated: false,
  };

  try {
    // Try to find competitor page by tag (fast path)
    let competitorPage = null;
    if (tag) {
      const pageId = parseCompetitorTag(tag);
      if (pageId) {
        competitorPage = await prisma.competitorPage.findUnique({
          where: { id: pageId },
          include: {
            trackedQuery: {
              include: { categoryWatch: { include: { client: true } } },
            },
            snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
          },
        });
      }
    }

    // Fallback: find by domain + url match
    if (!competitorPage) {
      const domain = event.domain.replace(/^www\./, "").toLowerCase();
      const candidates = await prisma.competitorPage.findMany({
        where: {
          domain: { contains: domain },
          isMonitored: true,
          isActive: true,
        },
        include: {
          trackedQuery: {
            include: { categoryWatch: { include: { client: true } } },
          },
          snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
        },
      });

      // Match by URL if possible, otherwise take first domain match
      competitorPage =
        candidates.find((c) => event.url.includes(new URL(c.url).pathname)) ||
        candidates[0] ||
        null;
    }

    if (!competitorPage) {
      result.processed = false;
      return result;
    }

    result.competitorPageId = competitorPage.id;

    // Fetch fresh snapshot of the page
    const snapshotData = await fetchPageSnapshot(event.url);
    if (!snapshotData.rawHtmlHash) {
      result.processed = true;
      return result;
    }

    const previousSnapshot = competitorPage.snapshots[0] || null;

    // Check if content actually changed (hash comparison)
    if (previousSnapshot?.rawHtmlHash === snapshotData.rawHtmlHash) {
      result.processed = true;
      return result;
    }

    // Save new snapshot
    await competitorRepository.createSnapshot(competitorPage.id, snapshotData);

    // Detect meaningful changes
    if (previousSnapshot) {
      const changes = detectPageChanges(previousSnapshot, snapshotData);
      result.changesDetected = changes.length;

      if (changes.length > 0) {
        const recommendedAction =
          buildRecommendedActionForCompetitorChange(changes);

        const client = competitorPage.trackedQuery.categoryWatch.client;
        const category = competitorPage.trackedQuery.categoryWatch;
        const query = competitorPage.trackedQuery;

        await buildAlert({
          clientId: client.id,
          categoryWatchId: category.id,
          trackedQueryId: query.id,
          severity: changes.some(
            (c) => c.type === "content_expanded" || c.type === "title_changed"
          )
            ? "WARNING"
            : "INFO",
          type: "COMPETITOR_UPDATE",
          title: `[Firehose] ${competitorPage.domain} atualizou página`,
          message: changes.map((c) => c.description).join("; "),
          recommendedAction,
          metadata: {
            source: "firehose",
            changes,
            competitorUrl: event.url,
            detectedAt: new Date().toISOString(),
          },
        });

        result.alertCreated = true;
      }
    }

    result.processed = true;
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}
