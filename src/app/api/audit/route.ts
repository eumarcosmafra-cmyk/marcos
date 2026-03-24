import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai-client";
import { ANALYSIS_PROMPTS } from "@/lib/seo-prompts";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const prompt = ANALYSIS_PROMPTS.fullAudit(url);
    const response = await analyzeWithAI(prompt);

    // Try to parse JSON from the response
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
