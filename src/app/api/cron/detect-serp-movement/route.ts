import { NextRequest, NextResponse } from "next/server";
import { generateAlerts } from "@/jobs/generate-alerts";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await generateAlerts();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/detect-serp] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
