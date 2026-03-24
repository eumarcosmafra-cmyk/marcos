import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai-client";
import { ANALYSIS_PROMPTS } from "@/lib/seo-prompts";

export async function POST(request: NextRequest) {
  try {
    const { keyword, niche } = await request.json();

    if (!keyword || !niche) {
      return NextResponse.json(
        { error: "Keyword and niche are required" },
        { status: 400 }
      );
    }

    const prompt = ANALYSIS_PROMPTS.keywordResearch(keyword, niche);
    const response = await analyzeWithAI(prompt);

    let analysis;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { keyword, volume: 0, difficulty: 0, cpc: 0, trend: "stable", relatedKeywords: [], contentSuggestions: [] };
      }
    } catch {
      analysis = { keyword, volume: 0, difficulty: 0, cpc: 0, trend: "stable", relatedKeywords: [], contentSuggestions: [] };
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Keywords error:", error);
    return NextResponse.json(
      { error: "Failed to analyze keywords" },
      { status: 500 }
    );
  }
}
