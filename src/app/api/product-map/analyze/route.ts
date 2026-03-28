import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { callGemini, parseGeminiJSON } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const { categories } = await request.json();
    if (!categories?.length) {
      return NextResponse.json({ error: "No categories to analyze" }, { status: 400 });
    }

    const summary = categories.map((c: { category_name: string; abc_tier: string; revenue: number; product_count: number; category_position: number | null; quadrant: string }) =>
      `${c.category_name} (${c.abc_tier}): R$${c.revenue.toLocaleString('pt-BR')}, ${c.product_count} prods, pos ${c.category_position || 'N/A'}, quadrant: ${c.quadrant}`
    ).join('\n');

    const rawText = await callGemini({
      systemPrompt: "You are an ecommerce SEO strategist. Return valid JSON only.",
      userPrompt: `Analise estes dados de categorias e retorne diagnóstico em português.

DADOS:
${summary}

JSON:
{
  "executive_summary": "2-3 frases sobre a situação geral",
  "biggest_opportunity": "maior oportunidade de receita",
  "biggest_risk": "maior risco para receita atual",
  "top_actions": [
    { "action": "o que fazer (1 frase)", "category": "qual categoria", "revenue_at_stake": 0, "effort": "low|medium|high", "timeline": "esta semana|este mês|próximo trimestre" }
  ],
  "content_gap_summary": "estado do blog vs catálogo comercial",
  "abc_visibility_summary": "estado do ABC vs visibilidade orgânica"
}`,
      maxOutputTokens: 4000,
      temperature: 0.2,
    });

    const diagnosis = parseGeminiJSON(rawText);
    return NextResponse.json({ diagnosis });
  } catch (error) {
    console.error("[product-map/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
