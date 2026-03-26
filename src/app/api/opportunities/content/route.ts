import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGSCSites, matchDomainToGSCSite } from "@/lib/gsc-client";
import { detectContentOpportunities } from "@/services/content-opportunities/detect-opportunities";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const siteUrl = searchParams.get("siteUrl");
    const period = searchParams.get("period") || "28d";

    if (!siteUrl) {
      // Auto-detect from GSC
      const sites = await getGSCSites(session.accessToken);
      if (sites.length === 0) {
        return NextResponse.json({ opportunities: [], message: "Nenhum site no GSC" });
      }

      const opportunities = await detectContentOpportunities(
        session.accessToken,
        sites[0].siteUrl,
        period
      );

      return NextResponse.json({ opportunities, siteUrl: sites[0].siteUrl });
    }

    const opportunities = await detectContentOpportunities(
      session.accessToken,
      siteUrl,
      period
    );

    return NextResponse.json({ opportunities, siteUrl });
  } catch (error) {
    console.error("[opportunities/content] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
