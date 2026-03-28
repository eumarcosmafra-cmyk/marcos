import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai-client";
import { ANALYSIS_PROMPTS } from "@/lib/seo-prompts";
import { isDemoMode, MOCK_AUDIT } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (isDemoMode()) {
      const analysis = { ...MOCK_AUDIT, url, timestamp: new Date().toISOString() };
      return NextResponse.json({ analysis });
    }

    const prompt = ANALYSIS_PROMPTS.fullAudit(url);
    const response = await analyzeWithAI(prompt);

    let analysis;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { url, score: 0, summary: response, categories: [], recommendations: [] };
      }
    } catch {
      analysis = { url, score: 0, summary: response, categories: [], recommendations: [] };
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Audit error:", error);
    return NextResponse.json(
      { error: "Failed to perform audit" },
      { status: 500 }
    );
  }
}
