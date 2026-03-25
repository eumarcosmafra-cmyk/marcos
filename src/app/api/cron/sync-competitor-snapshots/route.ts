import { NextRequest, NextResponse } from "next/server";
import { syncCompetitorSnapshots } from "@/jobs/sync-competitor-snapshots";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncCompetitorSnapshots();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/competitors] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
