import { NextRequest, NextResponse } from "next/server";
import { syncFirehoseRules } from "@/services/firehose/sync-rules";

/**
 * POST /api/firehose/sync-rules
 *
 * Syncs Firehose rules with monitored competitor pages.
 * Creates rules for new competitors, removes rules for deactivated ones.
 * Can be called manually or from a cron job.
 */
export async function POST(request: NextRequest) {
  // Auth
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const tapToken = process.env.FIREHOSE_TAP_TOKEN;
  if (!tapToken) {
    return NextResponse.json(
      { error: "FIREHOSE_TAP_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await syncFirehoseRules(tapToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[firehose/sync-rules] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync rules" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/firehose/sync-rules
 * Vercel Cron compatible endpoint.
 */
export async function GET(request: NextRequest) {
  // Reuse POST logic
  return POST(request);
}
