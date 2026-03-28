import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { categories } = await request.json();
    if (!categories?.length) {
      return NextResponse.json({ error: "No categories to analyze" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const summary = categories.map((c: any) =>
      `${c.category_name} (${c.abc_tier}): R$${c.revenue.toLocaleString('pt-BR')}, ${c.product_count} prods, pos ${c.category_position || 'N/A'}, quadrant: ${c.quadrant}`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Você é um estrategista de SEO para e-commerce. Analise estes dados de categorias e retorne diagnóstico em português.

DADOS:
${summary}

JSON obrigatório:
{
  "executive_summary": "2-3 frases sobre a situação geral",
  "biggest_opportunity": "maior oportunidade de receita",
  "biggest_risk": "maior risco para receita atual",
  "top_actions": [
    { "action": "o que fazer (1 frase)", "category": "qual categoria", "revenue_at_stake": 0, "effort": "low|medium|high", "timeline": "esta semana|este mês|próximo trimestre" }
  ],
  "content_gap_summary": "estado do blog vs catálogo comercial",
  "abc_visibility_summary": "estado do ABC vs visibilidade orgânica"
}

Retorne APENAS JSON válido.`
      }],
    });

    const text = (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const diagnosis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return NextResponse.json({ diagnosis });
  } catch (error) {
    console.error("[product-map/analyze] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
