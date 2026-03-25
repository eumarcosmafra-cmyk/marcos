import {
  processFirehoseEvent,
  type FirehoseEvent,
} from "@/services/firehose/process-event";
import type { JobResult } from "./sync-serp-mapper";

/**
 * Poll Firehose SSE stream for buffered events.
 * Since Vercel functions can't hold long-lived SSE connections,
 * we poll with a limit to process batches of events.
 *
 * Firehose buffers events for ~24h, so polling every 30 min is fine.
 */
export async function pollFirehose(): Promise<
  JobResult & { alertsCreated: number }
> {
  const tapToken = process.env.FIREHOSE_TAP_TOKEN;
  if (!tapToken) {
    return {
      totalProcessed: 0,
      successCount: 0,
      failCount: 0,
      errors: ["FIREHOSE_TAP_TOKEN not configured"],
      alertsCreated: 0,
    };
  }

  const result = {
    totalProcessed: 0,
    successCount: 0,
    failCount: 0,
    errors: [] as string[],
    alertsCreated: 0,
  };

  try {
    // Fetch up to 100 events per poll
    // Using limit param so the stream closes after delivering events
    const lastEventId = await getLastEventId();
    const streamUrl = new URL("https://api.firehose.com/v1/stream");
    streamUrl.searchParams.set("limit", "100");
    if (lastEventId) {
      streamUrl.searchParams.set("offset", lastEventId);
    }

    const res = await fetch(streamUrl.toString(), {
      headers: {
        Authorization: `Bearer ${tapToken}`,
        Accept: "text/event-stream",
      },
      signal: AbortSignal.timeout(25000), // 25s max for Vercel
    });

    if (!res.ok) {
      result.errors.push(`Firehose stream error: ${res.status}`);
      return result;
    }

    const text = await res.text();
    const events = parseSSE(text);

    for (const sseEvent of events) {
      result.totalProcessed++;

      try {
        if (sseEvent.type === "update" && sseEvent.data) {
          const data = JSON.parse(sseEvent.data);
          const firehoseEvent: FirehoseEvent = {
            url: data.url || "",
            domain: data.domain || "",
            title: data.title,
            added: data.added,
            removed: data.removed,
            publish_time: data.publish_time,
            language: data.language,
            page_category: data.page_category,
          };

          const processResult = await processFirehoseEvent(
            firehoseEvent,
            data.tag
          );

          if (processResult.processed) {
            result.successCount++;
            if (processResult.alertCreated) result.alertsCreated++;
          } else {
            result.successCount++; // Not matched = skip, not failure
          }
        }

        // Save last event ID for next poll
        if (sseEvent.id) {
          await saveLastEventId(sseEvent.id);
        }
      } catch (error) {
        result.failCount++;
        result.errors.push(
          error instanceof Error ? error.message : "Parse error"
        );
      }
    }
  } catch (error) {
    // Timeout is expected when no events are available
    if (error instanceof Error && error.name === "TimeoutError") {
      // No events in buffer, that's fine
    } else {
      result.errors.push(
        `Poll failed: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  console.log(
    `[poll-firehose] ${result.successCount}/${result.totalProcessed} processed, ${result.alertsCreated} alerts`
  );

  return result;
}

// ─── SSE Parser ────────────────────────────────────────────────

interface SSEEvent {
  id?: string;
  type?: string;
  data?: string;
}

function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;

    const event: SSEEvent = {};
    const lines = block.split("\n");

    for (const line of lines) {
      if (line.startsWith("id:")) {
        event.id = line.slice(3).trim();
      } else if (line.startsWith("event:")) {
        event.type = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        event.data = (event.data || "") + line.slice(5).trim();
      }
    }

    if (event.data || event.type) {
      events.push(event);
    }
  }

  return events;
}

// ─── Cursor persistence (simple KV via DB) ─────────────────────

// Store last event ID in a simple way — uses env var file or DB
// For now, use a module-level variable (resets on cold start)
// In production, store in DB or Vercel KV
let _lastEventId: string | null = null;

async function getLastEventId(): Promise<string | null> {
  return _lastEventId;
}

async function saveLastEventId(id: string): Promise<void> {
  _lastEventId = id;
}
