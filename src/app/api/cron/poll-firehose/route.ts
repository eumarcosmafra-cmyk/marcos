import { NextRequest, NextResponse } from "next/server";
import { pollFirehose } from "@/jobs/poll-firehose";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.FIREHOSE_TAP_TOKEN) {
    return NextResponse.json(
      { skipped: true, reason: "FIREHOSE_TAP_TOKEN not configured" },
      { status: 200 }
    );
  }

  try {
    const result = await pollFirehose();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/poll-firehose] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
