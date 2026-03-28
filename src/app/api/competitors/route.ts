import { requireAuth, isAuthError } from "@/lib/require-auth";
import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai-client";
import { ANALYSIS_PROMPTS } from "@/lib/seo-prompts";
import { isDemoMode, MOCK_COMPETITORS } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  try {
    const { domain, competitors } = await request.json();

    if (!domain || !competitors || !Array.isArray(competitors)) {
      return NextResponse.json(
        { error: "Domain and competitors are required" },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      const mockComps = MOCK_COMPETITORS.competitors.map((c, i) => ({
        ...c,
        domain: competitors[i] || `concorrente${i + 1}.com.br`,
      }));
      const analysis = { ...MOCK_COMPETITORS, domain, competitors: mockComps };
      return NextResponse.json({ analysis });
    }

    const prompt = ANALYSIS_PROMPTS.competitorAnalysis(domain, competitors);
    const response = await analyzeWithAI(prompt);

    let analysis;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { domain, competitors: [], overlapKeywords: [], opportunities: [], contentGaps: [], actionPlan: [] };
      }
    } catch {
      analysis = { domain, competitors: [], overlapKeywords: [], opportunities: [], contentGaps: [], actionPlan: [] };
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Competitors error:", error);
    return NextResponse.json(
      { error: "Failed to analyze competitors" },
      { status: 500 }
    );
  }
}
