import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQueryPageData, findQuickWins, getDateRange } from "@/lib/gsc-client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const siteUrl = searchParams.get("siteUrl");
    const period = searchParams.get("period") || "28d";

    if (!siteUrl) {
      return NextResponse.json(
        { error: "siteUrl parameter is required" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = getDateRange(period);
    const queryPageData = await getQueryPageData(
      session.accessToken,
      siteUrl,
      startDate,
      endDate,
      500
    );

    const opportunities = findQuickWins(queryPageData);

    return NextResponse.json({
      opportunities,
      totalAnalyzed: queryPageData.length,
      period,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("GSC opportunities error:", error);
    return NextResponse.json(
      { error: "Failed to find opportunities" },
      { status: 500 }
    );
  }
}
