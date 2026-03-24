export const MOCK_CHAT_RESPONSES: Record<string, string> = {
  default: `Ótima pergunta! Como analista SEO sênior, vou te dar uma visão completa.

**Principais pontos a considerar:**

1. **Auditoria Técnica** — Sempre comece verificando a saúde técnica do site: Core Web Vitals, mobile-friendliness, velocidade de carregamento e indexação.

2. **Conteúdo de Qualidade** — O Google prioriza conteúdo que demonstra E-E-A-T (Experiência, Expertise, Autoridade e Confiabilidade). Foque em criar conteúdo profundo e útil.

3. **Estratégia de Keywords** — Mapeie a intenção de busca do seu público. Use uma combinação de keywords head terms (alto volume) e long-tail (alta conversão).

4. **Link Building** — Construa autoridade com backlinks de qualidade. Guest posts, digital PR e conteúdo linkável são as melhores estratégias.

5. **SEO Local** — Se o negócio é local, otimize o Google Business Profile, citações NAP e reviews.

**Próximos passos recomendados:**
- Rode uma auditoria completa na aba "Auditoria SEO"
- Pesquise suas keywords principais na aba "Keywords"
- Analise seus concorrentes diretos

Posso aprofundar em qualquer um desses tópicos. O que gostaria de explorar primeiro?`,

  "core web vitals": `## Como Melhorar o Core Web Vitals

Os Core Web Vitals são métricas essenciais que o Google usa para medir a experiência do usuário:

### 1. LCP (Largest Contentful Paint) — Meta: < 2.5s
- Otimize imagens (WebP/AVIF, lazy loading)
- Use CDN para assets estáticos
- Implemente preload para recursos críticos
- Minimize CSS e JS bloqueantes

### 2. INP (Interaction to Next Paint) — Meta: < 200ms
- Quebre tarefas longas de JavaScript
- Use web workers para processamento pesado
- Implemente code splitting
- Otimize event handlers

### 3. CLS (Cumulative Layout Shift) — Meta: < 0.1
- Defina dimensões para imagens/vídeos
- Reserve espaço para anúncios
- Evite inserção dinâmica de conteúdo acima do fold
- Use font-display: swap com fallback adequado

### Ferramentas para Monitoramento:
- Google PageSpeed Insights
- Chrome DevTools (Lighthouse)
- Web Vitals Extension
- Search Console (relatório de Core Web Vitals)

**Impacto esperado:** Melhorias nos CWV podem resultar em aumento de 5-15% no tráfego orgânico.`,

  "link building": `## Estratégia de Link Building para E-commerce

### Táticas de Alto Impacto:

**1. Digital PR (Prioridade Alta)**
- Crie estudos e pesquisas originais do seu nicho
- Desenvolva infográficos compartilháveis
- Ofereça dados exclusivos para jornalistas
- Use HARO/Connectively para oportunidades de mídia

**2. Guest Posting Estratégico (Prioridade Alta)**
- Identifique blogs relevantes com DA 40+
- Crie conteúdo exclusivo e de valor
- Inclua links contextuais (não só bio)
- Mantenha relevância temática

**3. Conteúdo Linkável (Prioridade Média)**
- Calculadoras e ferramentas interativas
- Guias definitivos (3000+ palavras)
- Templates e recursos gratuitos
- Estatísticas e benchmarks do setor

**4. Parcerias (Prioridade Média)**
- Co-marketing com marcas complementares
- Depoimentos para fornecedores
- Páginas de recursos de parceiros

### Métricas para Acompanhar:
- Novos domínios referenciadores/mês
- DR/DA médio dos links conquistados
- Tráfego de referência
- Posições de keywords-alvo

**Meta sugerida:** 10-20 novos backlinks de qualidade por mês.`,

  "meta descriptions": `## Otimização de Meta Descriptions para CTR

### Fórmula de Alta Performance:

**Estrutura ideal (150-160 caracteres):**
\`[Benefício principal] + [Diferencial] + [CTA]\`

### Exemplos por Intenção de Busca:

**Transacional:**
"Compre [produto] com até 50% OFF + frete grátis. Entrega em 24h para todo Brasil. Aproveite agora!"

**Informacional:**
"Descubra [tópico] com nosso guia completo de 2024. Dicas práticas de especialistas + templates grátis."

**Local:**
"[Serviço] em [cidade] com nota 4.9★. Atendimento imediato, orçamento grátis. Agende sua consulta!"

### Boas Práticas:
1. ✅ Inclua a keyword principal naturalmente
2. ✅ Use números e dados específicos
3. ✅ Adicione CTAs claros (Descubra, Aprenda, Compre)
4. ✅ Crie urgência quando apropriado
5. ✅ Destaque diferenciais (frete grátis, garantia)
6. ❌ Não duplique descriptions entre páginas
7. ❌ Não use clickbait enganoso

### Impacto Esperado:
- CTR médio pode aumentar de 2-3% para 5-8%
- Mais cliques = mais sinais positivos para o Google`,
};

export const MOCK_AUDIT = {
  url: "",
  score: 72,
  timestamp: new Date().toISOString(),
  summary: "O site apresenta uma base sólida de SEO, mas há oportunidades significativas de melhoria em SEO técnico e otimização de conteúdo. Os principais problemas estão relacionados à velocidade de carregamento, falta de schema markup e oportunidades perdidas de keywords long-tail.",
  categories: [
    {
      name: "SEO On-Page",
      score: 78,
      status: "good" as const,
      issues: [
        {
          severity: "warning" as const,
          title: "Meta descriptions ausentes em 12 páginas",
          description: "Páginas importantes do site não possuem meta descriptions otimizadas, perdendo oportunidade de CTR.",
          impact: "Redução de 15-20% no CTR orgânico",
          howToFix: "Crie meta descriptions únicas de 150-160 caracteres para cada página, incluindo keyword principal e CTA.",
        },
        {
          severity: "warning" as const,
          title: "Heading structure inconsistente",
          description: "Algumas páginas possuem múltiplos H1 ou pulos na hierarquia (H1 → H3).",
          impact: "Confusão para crawlers na interpretação do conteúdo",
          howToFix: "Use apenas um H1 por página e siga a hierarquia sequencial (H1 → H2 → H3).",
        },
        {
          severity: "info" as const,
          title: "Alt text ausente em 8 imagens",
          description: "Imagens sem texto alternativo perdem oportunidade de indexação e acessibilidade.",
          impact: "Perda de tráfego de busca por imagens",
          howToFix: "Adicione alt text descritivo e relevante em todas as imagens.",
        },
      ],
    },
    {
      name: "SEO Técnico",
      score: 65,
      status: "needs_improvement" as const,
      issues: [
        {
          severity: "critical" as const,
          title: "Core Web Vitals — LCP acima de 4s",
          description: "O Largest Contentful Paint está em 4.2 segundos, muito acima do limite recomendado de 2.5s.",
          impact: "Penalização direta no ranking e alta taxa de bounce",
          howToFix: "Otimize imagens (WebP), implemente lazy loading, use CDN e minimize JS/CSS bloqueante.",
        },
        {
          severity: "critical" as const,
          title: "Schema markup ausente",
          description: "O site não possui dados estruturados, perdendo oportunidades de rich snippets.",
          impact: "Perda de visibilidade nos resultados de busca (rich snippets, FAQ, etc)",
          howToFix: "Implemente schema markup Organization, Product/Service, FAQ e BreadcrumbList.",
        },
        {
          severity: "warning" as const,
          title: "Sitemap desatualizado",
          description: "O sitemap.xml não inclui 15 páginas recentes e contém URLs com erro 404.",
          impact: "Crawlers não descobrem conteúdo novo eficientemente",
          howToFix: "Configure geração automática do sitemap e remova URLs com erro.",
        },
      ],
    },
    {
      name: "Conteúdo",
      score: 74,
      status: "good" as const,
      issues: [
        {
          severity: "warning" as const,
          title: "Conteúdo thin em 5 páginas de categoria",
          description: "Páginas de categoria possuem menos de 300 palavras, sem valor informativo.",
          impact: "Páginas podem ser consideradas de baixa qualidade pelo Google",
          howToFix: "Adicione descrições detalhadas, FAQs e conteúdo relevante em cada categoria.",
        },
        {
          severity: "info" as const,
          title: "Oportunidades de topic clusters",
          description: "O blog cobre temas de forma isolada sem estratégia de pillar content.",
          impact: "Perda de autoridade temática e links internos",
          howToFix: "Crie pillar pages para temas principais e interligue com conteúdo de apoio.",
        },
      ],
    },
    {
      name: "Backlinks",
      score: 68,
      status: "needs_improvement" as const,
      issues: [
        {
          severity: "warning" as const,
          title: "Perfil de backlinks pouco diversificado",
          description: "70% dos backlinks vêm de apenas 3 domínios referenciadores.",
          impact: "Risco de dependência e fragilidade do perfil de links",
          howToFix: "Diversifique fontes com guest posts, digital PR e conteúdo linkável.",
        },
        {
          severity: "info" as const,
          title: "5 backlinks tóxicos detectados",
          description: "Links de diretórios spam e sites de baixa qualidade apontam para o domínio.",
          impact: "Risco baixo, mas pode ser sinalizado em auditoria manual",
          howToFix: "Use a ferramenta de disavow do Google Search Console para rejeitar esses links.",
        },
      ],
    },
    {
      name: "UX & Performance",
      score: 75,
      status: "good" as const,
      issues: [
        {
          severity: "warning" as const,
          title: "CLS alto em páginas com anúncios",
          description: "Cumulative Layout Shift de 0.18 nas páginas com banners, acima do limite de 0.1.",
          impact: "Experiência negativa e penalização nos Core Web Vitals",
          howToFix: "Reserve espaço fixo para banners e anúncios com width/height definidos.",
        },
        {
          severity: "info" as const,
          title: "Navegação mobile pode melhorar",
          description: "Menu hamburger não é facilmente acessível e CTAs são pequenos no mobile.",
          impact: "Redução na taxa de conversão mobile",
          howToFix: "Aumente áreas de toque para 44x44px e posicione CTAs no thumb zone.",
        },
      ],
    },
  ],
  recommendations: [
    {
      priority: "high" as const,
      category: "SEO Técnico",
      title: "Otimizar Core Web Vitals",
      description: "Foque em reduzir LCP para < 2.5s e CLS para < 0.1. Implemente lazy loading, otimize imagens e minimize JS bloqueante.",
      estimatedImpact: "Aumento de 10-20% no tráfego orgânico em 2-3 meses",
    },
    {
      priority: "high" as const,
      category: "SEO Técnico",
      title: "Implementar Schema Markup",
      description: "Adicione dados estruturados para Organization, Products, FAQ e Breadcrumbs.",
      estimatedImpact: "Aumento de 20-30% no CTR com rich snippets",
    },
    {
      priority: "high" as const,
      category: "SEO On-Page",
      title: "Otimizar meta descriptions",
      description: "Crie descriptions únicas e persuasivas para todas as páginas prioritárias.",
      estimatedImpact: "Aumento de 5-15% no CTR orgânico",
    },
    {
      priority: "medium" as const,
      category: "Conteúdo",
      title: "Criar estratégia de Topic Clusters",
      description: "Desenvolva pillar pages e conteúdo de apoio para os principais temas do negócio.",
      estimatedImpact: "Aumento de autoridade temática e rankings em 3-6 meses",
    },
    {
      priority: "medium" as const,
      category: "Backlinks",
      title: "Diversificar perfil de backlinks",
      description: "Implemente campanhas de digital PR e guest posting para novos domínios referenciadores.",
      estimatedImpact: "Aumento de DA/DR em 5-10 pontos em 6 meses",
    },
    {
      priority: "low" as const,
      category: "Conteúdo",
      title: "Enriquecer páginas de categoria",
      description: "Adicione conteúdo informativo, FAQs e links internos nas páginas de categoria thin.",
      estimatedImpact: "Melhoria gradual no ranking de keywords de categoria",
    },
  ],
};

export const MOCK_KEYWORDS = {
  keyword: "",
  volume: 14800,
  difficulty: 62,
  cpc: 3.45,
  trend: "up",
  searchIntent: "informational",
  relatedKeywords: [
    "estratégia de marketing digital",
    "marketing digital para iniciantes",
    "agência de marketing digital",
    "curso de marketing digital",
    "marketing digital 2024",
    "ferramentas de marketing digital",
    "marketing de conteúdo",
    "SEO e marketing digital",
  ],
  longTailKeywords: [
    "como fazer marketing digital para pequenas empresas",
    "melhores estratégias de marketing digital para e-commerce",
    "marketing digital para clínicas médicas",
    "quanto custa marketing digital por mês",
    "marketing digital resultados em quanto tempo",
    "como medir ROI de marketing digital",
  ],
  questions: [
    "O que é marketing digital e como funciona?",
    "Quanto custa investir em marketing digital?",
    "Qual a diferença entre marketing digital e tradicional?",
    "Como começar no marketing digital do zero?",
    "Quais as principais tendências de marketing digital?",
    "Marketing digital funciona para pequenas empresas?",
  ],
  contentSuggestions: [
    "Guia Completo de Marketing Digital para 2024: Estratégias que Funcionam",
    "Marketing Digital para Pequenas Empresas: Passo a Passo Prático",
    "10 Ferramentas de Marketing Digital Gratuitas para Começar Hoje",
    "Como Criar uma Estratégia de Marketing Digital em 7 Dias",
    "Marketing Digital: ROI Médio por Canal e Como Calcular",
  ],
  topicClusters: [
    {
      pillar: "Guia Completo de Marketing Digital",
      subtopics: [
        "SEO",
        "Mídia Paga",
        "Email Marketing",
        "Redes Sociais",
        "Marketing de Conteúdo",
        "Automação",
      ],
    },
    {
      pillar: "Marketing Digital para Negócios Locais",
      subtopics: [
        "Google Meu Negócio",
        "SEO Local",
        "Anúncios Locais",
        "Reviews e Reputação",
        "Redes Sociais Locais",
      ],
    },
    {
      pillar: "Métricas e Analytics",
      subtopics: [
        "Google Analytics 4",
        "KPIs de Marketing",
        "Atribuição de Conversão",
        "Relatórios de Performance",
        "A/B Testing",
      ],
    },
  ],
};

export const MOCK_COMPETITORS = {
  domain: "",
  competitors: [
    {
      domain: "",
      strengths: [
        "Alto volume de conteúdo publicado (20+ artigos/mês)",
        "Forte presença em redes sociais com engajamento orgânico",
        "DA 45+ com perfil diversificado de backlinks",
        "Rich snippets implementados em todas as páginas de produto",
      ],
      weaknesses: [
        "Velocidade do site abaixo da média (LCP > 3.5s)",
        "Conteúdo de blog genérico sem profundidade",
        "Sem estratégia de SEO local",
        "Mobile UX com problemas de CLS",
      ],
    },
    {
      domain: "",
      strengths: [
        "Excelente velocidade de carregamento (LCP < 1.8s)",
        "Conteúdo técnico de alta qualidade com E-E-A-T",
        "Estratégia sólida de link building com digital PR",
      ],
      weaknesses: [
        "Baixa frequência de publicação (2-3 artigos/mês)",
        "Falta de otimização para keywords transacionais",
        "Sem presença em YouTube ou vídeo content",
        "Estrutura de URLs não otimizada",
      ],
    },
  ],
  overlapKeywords: [
    "marketing digital",
    "SEO para empresas",
    "gestão de redes sociais",
    "agência digital",
    "criação de sites",
    "tráfego pago",
    "inbound marketing",
    "automação de marketing",
  ],
  opportunities: [
    "Criar conteúdo em vídeo (YouTube) — nenhum concorrente forte neste canal",
    "Investir em SEO local — gap significativo no mercado regional",
    "Desenvolver ferramentas/calculadoras gratuitas para gerar backlinks",
    "Focar em keywords transacionais de cauda longa com menor concorrência",
    "Criar estudos de caso detalhados com dados reais de clientes",
  ],
  contentGaps: [
    "Guias práticos de implementação (passo a passo técnico)",
    "Comparativos de ferramentas e plataformas",
    "Conteúdo sobre IA aplicada ao marketing digital",
    "Templates e frameworks gratuitos para download",
    "Webinars e conteúdo educacional em formato de vídeo",
  ],
  actionPlan: [
    "Realizar auditoria completa de conteúdo e identificar páginas para atualizar",
    "Criar 3 pillar pages sobre os temas com maior gap de conteúdo",
    "Implementar schema markup em todas as páginas de serviço",
    "Iniciar programa de guest posting com 5 publicações/mês",
    "Desenvolver 2 ferramentas gratuitas para geração de leads e backlinks",
    "Lançar canal no YouTube com vídeos semanais sobre marketing digital",
    "Otimizar Core Web Vitals para superar benchmark dos concorrentes",
  ],
};

export const MOCK_REPORT = (clientName: string, domain: string, score: number, type: string) => `
═══════════════════════════════════════════════════
        RELATÓRIO DE SEO — ${clientName.toUpperCase()}
═══════════════════════════════════════════════════
Domínio: ${domain}
Score Atual: ${score}/100
Tipo: Análise ${type}
Data: ${new Date().toLocaleDateString("pt-BR")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. RESUMO EXECUTIVO

O site ${domain} apresenta um score de SEO de ${score}/100, indicando ${score >= 70 ? "uma base sólida com oportunidades de otimização" : "necessidade de melhorias significativas em áreas-chave"}. Nossa análise identificou pontos críticos em SEO técnico e oportunidades em conteúdo e link building que podem impulsionar significativamente a visibilidade orgânica.

A principal prioridade é resolver os problemas técnicos que impactam a indexação e performance, seguido pela otimização de conteúdo existente e expansão da estratégia de keywords.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SITUAÇÃO ATUAL

✅ Pontos Positivos:
• Site responsivo e mobile-friendly
• HTTPS implementado corretamente
• Estrutura de URLs relativamente limpa
• Conteúdo relevante para o público-alvo
• Google Business Profile configurado

❌ Pontos de Melhoria:
• Core Web Vitals abaixo dos limiares recomendados
• Meta descriptions ausentes em páginas importantes
• Falta de dados estruturados (schema markup)
• Perfil de backlinks limitado e pouco diversificado
• Conteúdo thin em páginas de categoria

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. TOP 5 PROBLEMAS CRÍTICOS

🔴 1. Core Web Vitals — LCP em 4.2s (meta: < 2.5s)
   Impacto: Penalização direta no ranking e taxa de bounce elevada

🔴 2. Schema Markup Ausente
   Impacto: Perda de rich snippets e menor CTR nos resultados

🟡 3. 15 Páginas sem Meta Description Otimizada
   Impacto: CTR abaixo do potencial em buscas orgânicas

🟡 4. Sitemap Desatualizado com URLs 404
   Impacto: Crawl budget desperdiçado e páginas não indexadas

🟡 5. Conteúdo Thin em Categorias
   Impacto: Páginas sem valor para o Google e usuários

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. TOP 5 OPORTUNIDADES

🚀 1. Implementar Topic Clusters
   Potencial: +30-50% tráfego orgânico em 6 meses

🚀 2. Criar Conteúdo para Keywords Long-Tail
   Potencial: +200 keywords ranqueando na primeira página

🚀 3. Digital PR para Link Building
   Potencial: +15 backlinks de qualidade/mês

🚀 4. Otimização de Featured Snippets
   Potencial: +40% visibilidade para buscas informacionais

🚀 5. SEO Local Avançado
   Potencial: +25% tráfego local qualificado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. PLANO DE AÇÃO

📅 PRIMEIROS 30 DIAS (Quick Wins):
• Corrigir Core Web Vitals (otimizar imagens, lazy loading, minificar CSS/JS)
• Criar meta descriptions para as 15 páginas prioritárias
• Atualizar sitemap.xml e corrigir URLs 404
• Implementar schema markup básico (Organization, Breadcrumb)

📅 30-60 DIAS (Consolidação):
• Desenvolver 3 pillar pages para topic clusters
• Enriquecer páginas de categoria com conteúdo útil
• Iniciar campanha de guest posting (5 posts/mês)
• Configurar monitoramento de Core Web Vitals

📅 60-90 DIAS (Crescimento):
• Expandir estratégia de conteúdo (8 artigos/mês)
• Implementar schema markup avançado (FAQ, HowTo, Product)
• Otimizar para featured snippets (top 20 keywords)
• Lançar campanha de digital PR

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. KPIs PARA ACOMPANHAMENTO

📊 Métricas Primárias:
• Tráfego orgânico (meta: +30% em 90 dias)
• Keywords na 1ª página (meta: +50 keywords)
• Score SEO geral (meta: ${Math.min(score + 20, 95)}/100)

📊 Métricas Secundárias:
• CTR orgânico médio (meta: > 5%)
• Core Web Vitals (meta: todos no verde)
• Novos backlinks/mês (meta: 15+)
• Taxa de bounce (meta: < 40%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. PRÓXIMOS PASSOS

1. Aprovar o plano de ação apresentado
2. Agendar reunião de kick-off para alinhar prioridades
3. Iniciar implementação dos quick wins (semana 1)
4. Configurar dashboards de acompanhamento
5. Revisão quinzenal de progresso e ajustes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Relatório gerado por SEO Analyst AI
Powered by Claude — Análise Profissional de SEO
`.trim();

export function isDemoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

export function getMockChatResponse(lastMessage: string): string {
  const lower = lastMessage.toLowerCase();
  if (lower.includes("core web") || lower.includes("vitals") || lower.includes("velocidade") || lower.includes("performance"))
    return MOCK_CHAT_RESPONSES["core web vitals"];
  if (lower.includes("link building") || lower.includes("backlink"))
    return MOCK_CHAT_RESPONSES["link building"];
  if (lower.includes("meta description") || lower.includes("ctr") || lower.includes("meta"))
    return MOCK_CHAT_RESPONSES["meta descriptions"];
  return MOCK_CHAT_RESPONSES["default"];
}
