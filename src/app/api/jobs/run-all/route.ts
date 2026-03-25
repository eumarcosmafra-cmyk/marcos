import { NextRequest, NextResponse } from "next/server";
import { syncSerpMapper } from "@/jobs/sync-serp-mapper";
import { generateAlerts } from "@/jobs/generate-alerts";
import { syncCompetitorSnapshots } from "@/jobs/sync-competitor-snapshots";
import { generateActionQueue } from "@/jobs/generate-action-queue";

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[run-all] Starting all jobs...");

    const serpResult = await syncSerpMapper();
    const alertsResult = await generateAlerts();
    const competitorResult = await syncCompetitorSnapshots();
    const actionResult = await generateActionQueue();

    return NextResponse.json({
      serp: serpResult,
      alerts: alertsResult,
      competitors: competitorResult,
      actions: actionResult,
    });
  } catch (error) {
    console.error("[run-all] Error:", error);
    return NextResponse.json(
      { error: "Job execution failed" },
      { status: 500 }
    );
  }
}
