import { fetchSerpTop10 } from "@/services/serp/fetch-serp-top10";
import { analyzeWithAI } from "@/lib/ai-client";
import type { SerpAnalysisResult, ContentBrief } from "@/types/content-opportunity";

export async function analyzeSerpForOpportunity(
  query: string,
  clientDomain: string
): Promise<SerpAnalysisResult> {
  const serp = await fetchSerpTop10(query);
  const raw = serp.rawJson as Record<string, unknown>;

  // Extract features from raw Serper response
  const paaQuestions = ((raw.peopleAlsoAsk || []) as { question: string }[]).map(p => p.question);
  const relatedSearches = ((raw.relatedSearches || []) as { query: string }[]).map(r => r.query);
  const hasAnswerBox = !!raw.answerBox;
  const hasKnowledgeGraph = !!raw.knowledgeGraph;

  // Analyze top 5
  const top5 = serp.results.slice(0, 5).map(r => {
    const titlePattern = detectTitlePattern(r.title);
    const freshness = estimateFreshness(r.snippet || "");
    return {
      position: r.position,
      domain: r.domain,
      url: r.link,
      title: r.title,
      snippet: r.snippet || "",
      titlePattern,
      estimatedFreshness: freshness,
    };
  });

  // Detect dominant content type from titles
  const dominantType = detectDominantType(top5.map(r => r.title));

  // Identify competitor weaknesses
  const weaknesses: string[] = [];
  if (!hasAnswerBox) weaknesses.push("Nenhum featured snippet — oportunidade para resposta direta");
  if (paaQuestions.length > 0) weaknesses.push(`${paaQuestions.length} perguntas PAA sem resposta dedicada`);
  const staleCount = top5.filter(r => r.estimatedFreshness === "stale").length;
  if (staleCount >= 2) weaknesses.push(`${staleCount} dos top 5 com conteúdo potencialmente desatualizado`);
  const clientInTop5 = top5.some(r => r.domain.includes(clientDomain));
  if (!clientInTop5) weaknesses.push("Cliente não aparece no Top 5");

  return {
    dominantType,
    features: {
      hasFeaturedSnippet: hasAnswerBox,
      hasPeopleAlsoAsk: paaQuestions.length > 0,
      paaQuestions,
      hasKnowledgePanel: hasKnowledgeGraph,
      hasVideoResults: false,
      relatedSearches,
    },
    top5,
    competitorWeaknesses: weaknesses,
  };
}

function detectTitlePattern(title: string): string {
  const lower = title.toLowerCase();
  if (/^\d+\s/.test(lower) || /\btop\s+\d+/i.test(lower)) return "Lista/Top X";
  if (/como\s/i.test(lower) || /how\s+to/i.test(lower)) return "How-to/Guia";
  if (/\bvs\.?\b/i.test(lower) || /comparar|comparativo/i.test(lower)) return "Comparativo";
  if (/o\s+que\s+[eé]/i.test(lower) || /what\s+is/i.test(lower)) return "Definição";
  if (/melhor|best/i.test(lower)) return "Best of/Melhor";
  if (/guia\s+completo|complete\s+guide/i.test(lower)) return "Guia Completo";
  if (/\?/.test(title)) return "Pergunta/FAQ";
  return "Outro";
}

function detectDominantType(titles: string[]): SerpAnalysisResult["dominantType"] {
  const patterns = titles.map(t => detectTitlePattern(t));
  const counts: Record<string, number> = {};
  for (const p of patterns) counts[p] = (counts[p] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0] || "";

  if (top.includes("Lista")) return "listicle";
  if (top.includes("How-to") || top.includes("Guia")) return "guide";
  if (top.includes("Comparativo")) return "comparison";
  if (top.includes("Pergunta") || top.includes("FAQ")) return "faq";
  if (top.includes("Best")) return "listicle";
  return "other";
}

function estimateFreshness(snippet: string): "fresh" | "recent" | "stale" | "unknown" {
  const currentYear = new Date().getFullYear();
  if (snippet.includes(String(currentYear))) return "fresh";
  if (snippet.includes(String(currentYear - 1))) return "recent";
  if (snippet.match(/20[12]\d/) && !snippet.includes(String(currentYear)) && !snippet.includes(String(currentYear - 1))) return "stale";
  return "unknown";
}

export async function generateContentBrief(
  query: string,
  serpAnalysis: SerpAnalysisResult,
  clientDomain: string,
  existingPageUrl?: string
): Promise<ContentBrief> {
  const top5Summary = serpAnalysis.top5
    .map(r => `${r.position}. ${r.title} (${r.domain}) - Tipo: ${r.titlePattern}`)
    .join("\n");

  const paaList = serpAnalysis.features.paaQuestions.join("\n- ");

  const prompt = `Analise a SERP para a query "${query}" e gere um brief de conteúdo otimizado para SEO.

## Top 5 resultados atuais:
${top5Summary}

## Tipo dominante de conteúdo: ${serpAnalysis.dominantType}

## People Also Ask:
- ${paaList || "Nenhuma pergunta encontrada"}

## Fraquezas dos concorrentes:
${serpAnalysis.competitorWeaknesses.map(w => `- ${w}`).join("\n")}

## Domínio do cliente: ${clientDomain}
${existingPageUrl ? `## URL existente: ${existingPageUrl}` : "## Não há página dedicada — conteúdo novo"}

## Instruções:
Gere um content brief em JSON com:
1. titleSuggestions: 3 títulos otimizados para CTR e SEO (em português BR)
2. recommendedFormat: tipo de conteúdo recomendado (guia, lista, comparativo, FAQ, etc.)
3. wordCountTarget: quantidade de palavras recomendada
4. keyTopics: 5-8 tópicos/seções obrigatórios
5. uniqueAngle: o ângulo ÚNICO que diferencia este conteúdo dos top 5 (information gain — o que os concorrentes NÃO cobrem)
6. noveltyScore: 0-1 estimativa de quanta informação nova este conteúdo pode trazer
7. duplicationRisk: 0-1 risco de ficar near-duplicate dos concorrentes
8. headingStructure: outline com H2/H3 sugeridos
9. paaToTarget: quais perguntas PAA responder diretamente
10. internalLinkingSuggestions: sugestões de links internos

IMPORTANTE: O ângulo único deve ser ESPECÍFICO e ACIONÁVEL, não genérico. Pense em dados proprietários, experiência prática, comparativos que ninguém fez, perspectiva local brasileira, etc.

Responda APENAS em JSON válido.`;

  const response = await analyzeWithAI(prompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        titleSuggestions: parsed.titleSuggestions || [],
        recommendedFormat: parsed.recommendedFormat || serpAnalysis.dominantType,
        wordCountTarget: parsed.wordCountTarget || 1500,
        keyTopics: parsed.keyTopics || [],
        uniqueAngle: parsed.uniqueAngle || "",
        noveltyScore: Number(parsed.noveltyScore) || 0.5,
        duplicationRisk: Number(parsed.duplicationRisk) || 0.3,
        headingStructure: parsed.headingStructure || [],
        paaToTarget: parsed.paaToTarget || [],
        internalLinkingSuggestions: parsed.internalLinkingSuggestions || [],
      };
    }
  } catch (e) { console.error("[analyze-serp] Error:", e); }

  // Fallback
  return {
    titleSuggestions: [`Guia completo: ${query}`],
    recommendedFormat: serpAnalysis.dominantType,
    wordCountTarget: 1500,
    keyTopics: [query],
    uniqueAngle: "Perspectiva prática com dados do nicho",
    noveltyScore: 0.5,
    duplicationRisk: 0.3,
    headingStructure: [`H2: O que é ${query}`, `H2: Como funciona`, `H2: Conclusão`],
    paaToTarget: serpAnalysis.features.paaQuestions.slice(0, 3),
    internalLinkingSuggestions: [],
  };
}
