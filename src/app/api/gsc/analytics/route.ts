import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSiteOverview, getDateRange } from "@/lib/gsc-client";

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
    const data = await getSiteOverview(
      session.accessToken,
      siteUrl,
      startDate,
      endDate
    );

    return NextResponse.json({ data, period, startDate, endDate });
  } catch (error) {
    console.error("GSC analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
