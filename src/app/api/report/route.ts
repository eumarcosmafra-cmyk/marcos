import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/ai-client";
import { isDemoMode, MOCK_REPORT } from "@/lib/mock-data";

export async function POST(request: NextRequest) {
  try {
    const { clientName, domain, score, type } = await request.json();

    if (isDemoMode()) {
      const report = MOCK_REPORT(clientName || "Cliente Demo", domain || "exemplo.com.br", score || 65, type || "completa");
      return NextResponse.json({ report });
    }

    const prompt = `Gere um relatório profissional de SEO para apresentar ao cliente com os seguintes dados:

**Cliente:** ${clientName}
**Domínio:** ${domain}
**Score Atual:** ${score}/100
**Tipo de Análise:** ${type}

O relatório deve incluir:
1. Resumo Executivo (2-3 parágrafos)
2. Situação Atual do SEO (pontos positivos e negativos)
3. Top 5 Problemas Críticos identificados
4. Top 5 Oportunidades de Melhoria
5. Plano de Ação com cronograma sugerido (30/60/90 dias)
6. KPIs para Acompanhamento
7. Próximos Passos Recomendados

O relatório deve ser profissional, claro e acionável. Use linguagem que o cliente não-técnico possa entender, mas mantenha a profundidade técnica necessária.`;

    const response = await analyzeWithAI(prompt);

    return NextResponse.json({ report: response });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
