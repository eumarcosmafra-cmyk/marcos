import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { analyzeSerpForOpportunity, generateContentBrief } from "@/services/content-opportunities/analyze-serp";
import { hasSerpApi } from "@/lib/env";

const analyzeSchema = z.object({
  query: z.string().min(1),
  clientDomain: z.string().min(1),
  pageUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query, clientDomain, pageUrl } = parsed.data;

    if (!hasSerpApi()) {
      return NextResponse.json(
        { error: "SERP API key not configured" },
        { status: 400 }
      );
    }

    // Step 1: SERP analysis
    const serpAnalysis = await analyzeSerpForOpportunity(query, clientDomain);

    // Step 2: Content brief generation (uses Claude)
    let contentBrief = null;
    try {
      contentBrief = await generateContentBrief(
        query,
        serpAnalysis,
        clientDomain,
        pageUrl
      );
    } catch (e) {
      console.warn("[analyze] Brief generation failed:", e);
    }

    return NextResponse.json({
      serpAnalysis,
      contentBrief,
    });
  } catch (error) {
    console.error("[opportunities/content/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
