import { syncFirehoseRules } from "./sync-rules";

/**
 * Trigger Firehose rule sync if configured.
 * Runs silently — never throws, never blocks the caller.
 */
export async function triggerFirehoseRuleSync(): Promise<void> {
  const tapToken = process.env.FIREHOSE_TAP_TOKEN;
  if (!tapToken) return;

  try {
    await syncFirehoseRules(tapToken);
  } catch (error) {
    console.warn(
      "[firehose-auto-sync] Failed:",
      error instanceof Error ? error.message : error
    );
  }
}
