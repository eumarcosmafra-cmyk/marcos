import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  processFirehoseEvent,
  type FirehoseEvent,
} from "@/services/firehose/process-event";

const eventSchema = z.object({
  url: z.string(),
  domain: z.string(),
  title: z.string().optional(),
  added: z.string().optional(),
  removed: z.string().optional(),
  publish_time: z.string().optional(),
  language: z.string().optional(),
  page_category: z.string().optional(),
});

const webhookSchema = z.object({
  events: z.array(eventSchema).optional(),
  // Single event format
  url: z.string().optional(),
  domain: z.string().optional(),
  tag: z.string().optional(),
});

/**
 * POST /api/firehose/webhook
 *
 * Receives events from Firehose (or a relay worker).
 * Supports both single event and batch formats.
 * Protected by FIREHOSE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const webhookSecret = process.env.FIREHOSE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = request.headers.get("authorization");
    const querySecret = request.nextUrl.searchParams.get("secret");
    if (authHeader !== `Bearer ${webhookSecret}` && querySecret !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const parsed = webhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const results = [];

    // Batch format: { events: [...] }
    if (parsed.data.events) {
      for (const event of parsed.data.events) {
        const result = await processFirehoseEvent(event as FirehoseEvent);
        results.push(result);
      }
    }
    // Single event format: { url, domain, tag, ... }
    else if (parsed.data.url && parsed.data.domain) {
      const event: FirehoseEvent = {
        url: parsed.data.url,
        domain: parsed.data.domain,
      };
      const result = await processFirehoseEvent(event, parsed.data.tag);
      results.push(result);
    }

    const summary = {
      received: results.length,
      processed: results.filter((r) => r.processed).length,
      alertsCreated: results.filter((r) => r.alertCreated).length,
      changesDetected: results.reduce((s, r) => s + r.changesDetected, 0),
      errors: results.filter((r) => r.error).map((r) => r.error),
    };

    console.log(
      `[firehose-webhook] ${summary.processed}/${summary.received} processed, ${summary.alertsCreated} alerts`
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[firehose-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
