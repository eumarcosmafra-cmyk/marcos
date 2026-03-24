export const SEO_ANALYST_SYSTEM_PROMPT = `Você é um Analista de SEO SÊNIOR com mais de 15 anos de experiência em otimização para mecanismos de busca. Seu nome é SEO Analyst AI.

## Suas Especialidades:
- SEO On-Page (titles, meta descriptions, headings, content optimization)
- SEO Técnico (Core Web Vitals, schema markup, crawlability, indexação)
- SEO de Conteúdo (keyword research, content strategy, topic clusters)
- Link Building & Autoridade de Domínio
- SEO Local e Internacional
- E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)
- Análise de Concorrentes
- Google Search Console & Analytics

## Formato de Resposta:
- Sempre responda em português brasileiro
- Seja direto e prático nas recomendações
- Priorize ações por impacto (alto, médio, baixo)
- Inclua estimativas de impacto quando possível
- Use dados e métricas para embasar recomendações
- Forneça exemplos concretos de implementação

## Metodologia de Análise:
1. DIAGNÓSTICO: Identifique o estado atual
2. PROBLEMAS: Liste issues por severidade (crítico > warning > info)
3. OPORTUNIDADES: Identifique quick wins e melhorias estratégicas
4. PLANO DE AÇÃO: Recomendações priorizadas com passos práticos
5. MÉTRICAS: KPIs para acompanhar o progresso

## Regras:
- Nunca invente dados ou métricas - seja honesto sobre limitações
- Sempre considere as diretrizes mais recentes do Google
- Foque em estratégias white-hat sustentáveis
- Considere o contexto do nicho/indústria do cliente
- Quando analisar URLs, forneça feedback específico e acionável`;

export const ANALYSIS_PROMPTS = {
  fullAudit: (url: string) => `Realize uma auditoria SEO completa e detalhada para: ${url}

Analise os seguintes aspectos e forneça uma pontuação de 0-100 para cada:

1. **SEO On-Page** (Title tags, meta descriptions, headings H1-H6, URLs, imagens alt text, links internos)
2. **SEO Técnico** (Velocidade, mobile-friendly, HTTPS, sitemap, robots.txt, canonical tags, schema markup)
3. **Conteúdo** (Qualidade, relevância, E-E-A-T, keyword usage, readability, freshness)
4. **Backlinks** (Perfil de links, autoridade, diversidade, toxicidade)
5. **UX** (Core Web Vitals, navegação, CTA, engagement)

Para cada categoria, forneça:
- Score (0-100)
- Issues encontradas com severidade
- Recomendações priorizadas

Responda em formato JSON seguindo esta estrutura:
{
  "url": "string",
  "score": number,
  "categories": [
    {
      "name": "string",
      "score": number,
      "status": "excellent|good|needs_improvement|critical",
      "issues": [{"severity": "critical|warning|info", "title": "string", "description": "string", "impact": "string", "howToFix": "string"}]
    }
  ],
  "summary": "string com resumo executivo",
  "recommendations": [
    {"priority": "high|medium|low", "category": "string", "title": "string", "description": "string", "estimatedImpact": "string"}
  ]
}`,

  keywordResearch: (keyword: string, niche: string) => `Realize uma análise completa de keywords para o nicho "${niche}" com foco na keyword principal: "${keyword}"

Forneça:
1. Análise da keyword principal (intenção de busca, dificuldade estimada, potencial)
2. Keywords relacionadas (long-tail, LSI, perguntas)
3. Topic clusters sugeridos
4. Sugestões de conteúdo para cada keyword
5. Estratégia de implementação

Responda em JSON:
{
  "keyword": "string",
  "volume": number (estimado),
  "difficulty": number (0-100),
  "cpc": number (estimado em BRL),
  "trend": "up|down|stable",
  "searchIntent": "informational|navigational|transactional|commercial",
  "relatedKeywords": ["string"],
  "longTailKeywords": ["string"],
  "questions": ["string"],
  "contentSuggestions": ["string"],
  "topicClusters": [{"pillar": "string", "subtopics": ["string"]}]
}`,

  competitorAnalysis: (domain: string, competitors: string[]) => `Analise o domínio ${domain} em comparação com os concorrentes: ${competitors.join(", ")}

Forneça:
1. Pontos fortes e fracos de cada concorrente
2. Keywords em que os concorrentes ranqueiam e o domínio não
3. Gaps de conteúdo e oportunidades
4. Estratégias que os concorrentes estão usando
5. Recomendações para superar a concorrência

Responda em JSON:
{
  "domain": "string",
  "competitors": [
    {
      "domain": "string",
      "strengths": ["string"],
      "weaknesses": ["string"]
    }
  ],
  "overlapKeywords": ["string"],
  "opportunities": ["string"],
  "contentGaps": ["string"],
  "actionPlan": ["string"]
}`,

  contentOptimization: (content: string, targetKeyword: string) => `Analise o seguinte conteúdo para otimização SEO com foco na keyword "${targetKeyword}":

${content}

Forneça:
1. Score atual de otimização (0-100)
2. Análise de keyword density e placement
3. Análise de heading structure
4. Sugestões de melhoria no conteúdo
5. Meta title e description otimizados
6. Schema markup recomendado
7. Links internos sugeridos

Responda em formato estruturado com recomendações acionáveis.`,
};
