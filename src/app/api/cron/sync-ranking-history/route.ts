import { NextRequest, NextResponse } from "next/server";
import { syncSerpMapper } from "@/jobs/sync-serp-mapper";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncSerpMapper();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/sync-ranking] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
