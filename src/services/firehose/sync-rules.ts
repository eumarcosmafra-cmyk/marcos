import { competitorRepository } from "@/repositories/competitor-repository";
import {
  listRules,
  createRule,
  deleteRule,
  buildUrlRule,
  buildCompetitorTag,
  type FirehoseRule,
} from "./firehose-client";

export interface SyncRulesResult {
  created: number;
  deleted: number;
  kept: number;
  errors: string[];
}

/**
 * Sync Firehose rules with our monitored competitor pages.
 * Creates rules for new competitors, removes rules for deactivated ones.
 */
export async function syncFirehoseRules(
  tapToken: string
): Promise<SyncRulesResult> {
  const result: SyncRulesResult = {
    created: 0,
    deleted: 0,
    kept: 0,
    errors: [],
  };

  try {
    // Get all monitored competitors from DB
    const competitors = await competitorRepository.findAllMonitored();

    // Get existing Firehose rules
    let existingRules: FirehoseRule[] = [];
    try {
      existingRules = await listRules(tapToken);
    } catch (e) {
      result.errors.push(
        `Failed to list rules: ${e instanceof Error ? e.message : "Unknown"}`
      );
      return result;
    }

    // Build map of existing rules by tag
    const existingByTag = new Map<string, FirehoseRule>();
    for (const rule of existingRules) {
      existingByTag.set(rule.tag, rule);
    }

    // Set of tags that should exist
    const desiredTags = new Set<string>();

    // Create rules for competitors that don't have one
    for (const comp of competitors) {
      const tag = buildCompetitorTag(comp.id);
      desiredTags.add(tag);

      if (existingByTag.has(tag)) {
        result.kept++;
        continue;
      }

      // Create new rule
      try {
        const query = buildUrlRule(comp.url);
        await createRule(tapToken, query, tag);
        result.created++;
      } catch (e) {
        result.errors.push(
          `Failed to create rule for ${comp.domain}: ${e instanceof Error ? e.message : "Unknown"}`
        );
      }
    }

    // Delete rules for competitors no longer monitored
    for (const [tag, rule] of existingByTag) {
      if (tag.startsWith("comp:") && !desiredTags.has(tag)) {
        try {
          await deleteRule(tapToken, rule.id);
          result.deleted++;
        } catch (e) {
          result.errors.push(
            `Failed to delete rule ${rule.id}: ${e instanceof Error ? e.message : "Unknown"}`
          );
        }
      }
    }
  } catch (error) {
    result.errors.push(
      `Sync failed: ${error instanceof Error ? error.message : "Unknown"}`
    );
  }

  console.log(
    `[firehose-sync] Rules: +${result.created} -${result.deleted} =${result.kept} (${result.errors.length} errors)`
  );

  return result;
}
