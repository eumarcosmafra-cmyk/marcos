import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap } from "@/lib/sitemap/parser";
import { getSearchAnalytics, getGSCSites, matchDomainToGSCSite, getDateRange } from "@/lib/gsc-client";
import Anthropic from "@anthropic-ai/sdk";
import type { SitemapUrl } from "@/types/category-map";

function filterBlogUrls(urls: SitemapUrl[]): SitemapUrl[] {
  return urls.filter((u) => {
    try {
      const path = new URL(u.loc).pathname;
      if (path === "/" || path === "") return false;
      if (/\.(xml|json|jpg|png|pdf)$/i.test(path)) return false;
      if (/\/(cart|checkout|account|login|admin|sitemap|politica|termos|contato)\b/i.test(path)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

function extractTitle(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  } catch {
    return url;
  }
}

interface UrlData {
  url: string;
  title: string;
  queries: { query: string; impressions: number; clicks: number }[];
  totalImpressions: number;
  totalClicks: number;
}

// Step 1: Scan sitemap + enrich with GSC — returns URL data for all pages
async function scanUrls(sitemapUrl: string, siteUrl: string | undefined, period: string, accessToken: string | undefined): Promise<UrlData[]> {
  const allUrls = await parseSitemap(sitemapUrl);
  const blogUrls = filterBlogUrls(allUrls);
  if (blogUrls.length === 0) throw new Error("Nenhuma URL de conteúdo encontrada");

  const urlDataList: UrlData[] = [];

  if (accessToken) {
    let gscSiteUrl = siteUrl;
    if (!gscSiteUrl) {
      const sites = await getGSCSites(accessToken);
      const domain = new URL(blogUrls[0].loc).hostname.replace(/^www\./, "");
      gscSiteUrl = matchDomainToGSCSite(domain, sites) || undefined;
    }

    if (gscSiteUrl) {
      const { startDate, endDate } = getDateRange(period);
      const rows = await getSearchAnalytics(accessToken, gscSiteUrl, {
        startDate, endDate, dimensions: ["query", "page"], rowLimit: 5000,
      }) as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];

      for (const blogUrl of blogUrls) {
        const urlNorm = blogUrl.loc.replace(/\/$/, "").toLowerCase();
        const matching = rows.filter((r) => (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase() === urlNorm);
        const queries = matching
          .map((r) => ({ query: r.keys?.[0] || "", impressions: r.impressions || 0, clicks: r.clicks || 0 }))
          .sort((a, b) => b.impressions - a.impressions)
          .slice(0, 3);

        urlDataList.push({
          url: blogUrl.loc,
          title: extractTitle(blogUrl.loc),
          queries,
          totalImpressions: matching.reduce((s, r) => s + (r.impressions || 0), 0),
          totalClicks: matching.reduce((s, r) => s + (r.clicks || 0), 0),
        });
      }
    }
  }

  if (urlDataList.length === 0) {
    for (const blogUrl of blogUrls) {
      urlDataList.push({
        url: blogUrl.loc, title: extractTitle(blogUrl.loc),
        queries: [], totalImpressions: 0, totalClicks: 0,
      });
    }
  }

  return urlDataList;
}

// Step 2: Analyze a batch of URLs with Claude
async function analyzeBatch(urls: UrlData[], batchIndex: number, totalBatches: number): Promise<string> {
  const urlSummaries = urls.map((u) => {
    const topQ = u.queries.length > 0
      ? u.queries.map((q) => `${q.query}(${q.impressions}imp)`).join(", ")
      : "-";
    return `${u.title} | ${u.url} | ${topQ} | ${u.totalImpressions}imp ${u.totalClicks}cli`;
  }).join("\n");

  const prompt = `Classifique estas ${urls.length} URLs em clusters temáticos SEO.

URLS:
${urlSummaries}

Para cada URL retorne a classificação. IMPORTANTE: agrupe por tema semântico amplo, NÃO fragmente em micro-clusters.
Se dois temas compartilham a mesma entidade central, AGRUPE-OS.

JSON:
{
  "classificacoes": [
    { "url": "string", "title": "string", "cluster": "string", "entidade": "string", "intencao": "informacional|comercial|transacional", "impressoes": number, "cliques": number }
  ]
}

APENAS JSON.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });
    return (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
  } catch (e) {
    console.error("[content-intelligence] Batch AI error:", e);
    throw new Error(`AI batch error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Step 3: Merge all batch classifications into final cluster analysis
async function mergeAndAnalyze(allClassifications: { url: string; title: string; cluster: string; entidade: string; intencao: string; impressoes: number; cliques: number }[]): Promise<string> {
  // Group by cluster for a compact summary
  const clusterMap: Record<string, { entidade: string; urls: { url: string; title: string; intencao: string }[]; impressoes: number; cliques: number }> = {};

  for (const c of allClassifications) {
    const key = c.cluster;
    if (!clusterMap[key]) {
      clusterMap[key] = { entidade: c.entidade, urls: [], impressoes: 0, cliques: 0 };
    }
    clusterMap[key].urls.push({ url: c.url, title: c.title, intencao: c.intencao });
    clusterMap[key].impressoes += c.impressoes || 0;
    clusterMap[key].cliques += c.cliques || 0;
  }

  const clusterList = Object.entries(clusterMap).map(([name, d]) => ({
    nome: name,
    entidade: d.entidade,
    urls: d.urls,
    total_urls: d.urls.length,
    impressoes: d.impressoes,
    cliques: d.cliques,
  }));

  const prompt = `You are a senior SEO strategist analyzing blog content coverage for an e-commerce brand.

Given these pre-grouped clusters, generate a complete strategic analysis.

CLUSTERS:
${JSON.stringify(clusterList)}

For EACH cluster return:
1. cluster_name: string
2. cluster_type: "broad_pillar" | "medium" | "long_tail" | "seasonal"
3. central_entity: string
4. satellite_target: number (dynamic: broad=8-15, medium=4-8, long_tail=1-3, seasonal=2-4)
5. layers:
   - category_url: string|null (matching transactional category page if identifiable)
   - pillar_url: string|null (existing comprehensive blog post)
   - pillar_status: "exists"|"missing"|"weak"
   - satellite_urls: string[] (existing satellite URLs)
   - missing_satellites: string[] (specific suggested titles, max 5)
6. score: "strong"|"medium"|"weak_real"|"no_data"|"critical_gap"
   - strong: coverage >=70% + impressions >500
   - medium: coverage 40-69% OR impressions 50-500
   - weak_real: has data but impressions <50 or CTR <1%
   - no_data: no GSC data available
   - critical_gap: AI identified topic but ZERO URLs exist
7. score_reasoning: one sentence explaining the score
8. geo_score: "high"|"medium"|"low" (based on content structure, FAQ presence, answer format)
9. geo_recommendation: specific actionable improvement for AI citability
10. gsc_impressions: total impressions
11. gsc_clicks: total clicks
12. internal_links_to_category: boolean
13. merge_candidates: string[] (other cluster names this should merge with)

ALSO generate:
- executive_summary: 2-3 sentence strategic diagnosis (where strong, biggest gap, top action)
- priority_queue: top 5 clusters by opportunity, each with: cluster name, reason, action ("Criar pillar"|"Expandir"|"Otimizar GEO"|"Corrigir links"|"Criar do zero")

RULES:
- MERGE clusters sharing same entity + >60% intent overlap. Max 45-55 real clusters.
- satellite_target is DYNAMIC by type, not fixed at 5.
- missing_satellites must be SPECIFIC titles, not generic.
- Sort by opportunity (commercial gaps first).

JSON format:
{
  "clusters": [...],
  "executive_summary": "string",
  "priority_queue": [{"cluster":"","reason":"","action":""}]
}

ONLY valid JSON.`;

  console.log("[content-intelligence] Merge prompt length:", prompt.length, "clusters:", clusterList.length);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 12000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
  console.log("[content-intelligence] Merge response length:", text.length, "stop_reason:", message.stop_reason);
  return text;
}

// Semantic merge: combine clusters that reference each other in merge_candidates
function semanticMerge(clusters: any[]): any[] {
  const merged = new Map<string, any>();
  const mergeMap = new Map<string, string>(); // child -> parent

  for (const c of clusters) {
    if (c.merge_candidates?.length > 0) {
      for (const candidate of c.merge_candidates) {
        const existing = clusters.find((x: any) => x.cluster_name === candidate);
        if (existing && !mergeMap.has(c.cluster_name)) {
          mergeMap.set(candidate, c.cluster_name);
        }
      }
    }
  }

  for (const c of clusters) {
    const parent = mergeMap.get(c.cluster_name);
    if (parent && merged.has(parent)) {
      const p = merged.get(parent);
      p.gsc_impressions += c.gsc_impressions || 0;
      p.gsc_clicks += c.gsc_clicks || 0;
      if (c.layers?.satellite_urls) p.layers.satellite_urls.push(...c.layers.satellite_urls);
      if (!p.merged_from) p.merged_from = [];
      p.merged_from.push(c.cluster_name);
    } else {
      merged.set(c.cluster_name, { ...c });
    }
  }

  return Array.from(merged.values());
}

// Calculate opportunity score
function calculateOpportunityScore(c: any): number {
  const impressions = c.gsc_impressions || 0;
  const commercialWeight = c.layers?.category_url ? 1.5 : 1.0;
  const existing = (c.layers?.satellite_urls?.length || 0) + (c.layers?.pillar_url ? 1 : 0);
  const target = c.satellite_target || 5;
  const coverageRatio = Math.max(0.1, existing / target);
  const pillarFactor = c.layers?.pillar_status === 'missing' ? 2.0 : c.layers?.pillar_status === 'weak' ? 1.5 : 1.0;
  const geoMult = c.geo_score === 'low' && impressions > 10000 ? 1.3 : 1.0;
  return Math.round((impressions * commercialWeight) / coverageRatio * pillarFactor * geoMult);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sitemapUrl, siteUrl, period = "3m", step, batchData } = body;

    // STEP 1: Scan — parse sitemap + GSC enrichment (no AI, fast)
    if (step === "scan" || !step) {
      if (!sitemapUrl) return NextResponse.json({ error: "Informe a URL do sitemap" }, { status: 400 });
      const session = await auth().catch(() => null);

      let urlData: UrlData[];
      try {
        urlData = await scanUrls(sitemapUrl, siteUrl, period, session?.accessToken);
      } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao escanear" }, { status: 400 });
      }

      // Split into batches of 20
      const batchSize = 20;
      const batches: UrlData[][] = [];
      for (let i = 0; i < urlData.length; i += batchSize) {
        batches.push(urlData.slice(i, i + batchSize));
      }

      return NextResponse.json({
        step: "scan_complete",
        totalUrls: urlData.length,
        totalBatches: batches.length,
        batches: batches.map((b, i) => ({ index: i, urls: b })),
      });
    }

    // STEP 2: Analyze batch — classify one batch with AI
    if (step === "analyze_batch") {
      const { urls, batchIndex, totalBatches } = batchData;
      const aiResponse = await analyzeBatch(urls, batchIndex, totalBatches);
      let classifications;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) classifications = JSON.parse(jsonMatch[0]);
      } catch {}

      return NextResponse.json({
        step: "batch_complete",
        batchIndex,
        classifications: classifications?.classificacoes || [],
      });
    }

    // STEP 3: Merge — combine all classifications and generate final analysis
    if (step === "merge") {
      const { classifications } = batchData;
      const aiResponse = await mergeAndAnalyze(classifications);
      let analysis;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("[content-intelligence] Merge parse error:", e, "Response:", aiResponse.substring(0, 500));
      }

      if (!analysis) {
        // Fallback: build analysis from classifications directly
        const clusterMap: Record<string, { entidade: string; urls: { url: string; title: string; tipo_intencao: string }[]; impressoes: number; cliques: number }> = {};
        for (const c of classifications) {
          if (!clusterMap[c.cluster]) clusterMap[c.cluster] = { entidade: c.entidade, urls: [], impressoes: 0, cliques: 0 };
          clusterMap[c.cluster].urls.push({ url: c.url, title: c.title, tipo_intencao: c.intencao });
          clusterMap[c.cluster].impressoes += c.impressoes || 0;
          clusterMap[c.cluster].cliques += c.cliques || 0;
        }

        analysis = {
          clusters: Object.entries(clusterMap).map(([name, d]) => ({
            nome_cluster: name,
            cluster_type: "medium" as const,
            entidade_principal: d.entidade,
            satellite_target: 5,
            layers: {
              category_url: null,
              pillar_url: null,
              pillar_status: "missing" as const,
              satellite_urls: d.urls.map(u => u.url),
              missing_satellites: [],
            },
            score: d.impressoes > 500 ? "strong" as const : d.impressoes > 50 ? "medium" as const : d.impressoes > 0 ? "weak_real" as const : "no_data" as const,
            score_reasoning: d.impressoes > 500 ? "Cluster com boa tração" : "Cluster com cobertura limitada",
            geo_score: "medium" as const,
            geo_recommendation: "Adicionar FAQ e formatar respostas para AI",
            gsc_impressions: d.impressoes,
            gsc_clicks: d.cliques,
            internal_links_to_category: false,
            merge_candidates: [],
            urls: d.urls,
            total_urls: d.urls.length,
            metricas: { impressoes: d.impressoes, cliques: d.cliques, ctr_medio: d.impressoes > 0 ? d.cliques / d.impressoes : 0 },
            cobertura: { atual: d.urls.length, ideal: Math.max(d.urls.length + 2, 5), gap: Math.max(0, 5 - d.urls.length) },
            diagnostico: d.impressoes > 500 ? "Cluster com boa tração" : "Cluster com cobertura limitada",
            oportunidades: ["Expandir cobertura com mais conteúdos"],
          })),
          executive_summary: "Análise gerada via fallback. Verifique a cobertura dos clusters e priorize os gaps críticos.",
          priority_queue: Object.entries(clusterMap)
            .sort((a, b) => a[1].impressoes - b[1].impressoes)
            .slice(0, 5)
            .map(([name]) => ({ cluster: name, reason: "Baixa cobertura ou tração", action: "Expandir" })),
          resumo: {
            total_urls: classifications.length,
            total_clusters: Object.keys(clusterMap).length,
            critical_gaps: 0,
            overall_geo: "medium",
          },
        };
      } else {
        // Post-processing: normalize AI response to our expected format
        let clusters = analysis.clusters || [];

        // Map AI field names (cluster_name/central_entity) to our internal names
        clusters = clusters.map((c: any) => ({
          ...c,
          nome_cluster: c.cluster_name || c.nome_cluster || "Sem nome",
          entidade_principal: c.central_entity || c.entidade_principal || "",
        }));

        // 1. Run semantic merge
        clusters = semanticMerge(clusters);

        // 2. Calculate opportunity_score for each
        for (const c of clusters) {
          c.opportunity_score = calculateOpportunityScore(c);
        }

        // 3. Sort by opportunity_score descending
        clusters.sort((a: any, b: any) => (b.opportunity_score || 0) - (a.opportunity_score || 0));

        // 4. Separate no_data clusters into to_validate
        const toValidate = clusters.filter((c: any) => c.score === "no_data");
        const mainClusters = clusters.filter((c: any) => c.score !== "no_data");

        // Add computed fields for frontend compatibility
        for (const c of [...mainClusters, ...toValidate]) {
          const satelliteCount = c.layers?.satellite_urls?.length || 0;
          const target = c.satellite_target || 5;
          c.total_urls = satelliteCount + (c.layers?.pillar_url ? 1 : 0);
          c.cobertura = {
            atual: satelliteCount,
            ideal: target,
            gap: Math.max(0, target - satelliteCount),
          };
          c.metricas = {
            impressoes: c.gsc_impressions || 0,
            cliques: c.gsc_clicks || 0,
            ctr_medio: (c.gsc_impressions || 0) > 0 ? (c.gsc_clicks || 0) / (c.gsc_impressions || 0) : 0,
          };
        }

        analysis.clusters = mainClusters;
        analysis.to_validate = toValidate;

        // Build resumo
        const allClusters = [...mainClusters, ...toValidate];
        analysis.resumo = {
          total_urls: classifications.length,
          total_clusters: allClusters.length,
          critical_gaps: allClusters.filter((c: any) => c.score === "critical_gap").length,
          overall_geo: (() => {
            const geoScores = allClusters.map((c: any) => c.geo_score);
            const highCount = geoScores.filter((g: string) => g === "high").length;
            if (highCount > allClusters.length * 0.5) return "high";
            const lowCount = geoScores.filter((g: string) => g === "low").length;
            if (lowCount > allClusters.length * 0.5) return "low";
            return "medium";
          })(),
        };
      }

      return NextResponse.json({
        step: "complete",
        analysis,
        analyzedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Step inválido" }, { status: 400 });
  } catch (error) {
    console.error("[content-intelligence] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
