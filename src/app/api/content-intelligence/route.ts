import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap } from "@/lib/sitemap/parser";
import { getSearchAnalytics, getGSCSites, matchDomainToGSCSite, getDateRange } from "@/lib/gsc-client";
import { callGemini, parseGeminiJSON } from "@/lib/gemini";
import type { SitemapUrl } from "@/types/category-map";

// ============================================================
// Types
// ============================================================

interface BlogUrl {
  url: string;
  title: string;
  impressions: number;
  clicks: number;
  position: number;
  topQueries: { query: string; impressions: number; position: number }[];
}

interface ClusterLayer {
  category_url: string | null;
  pillar_url: string | null;
  pillar_status: "exists" | "missing" | "weak";
  satellite_urls: string[];
  missing_satellites: string[];
}

interface RawCluster {
  cluster_name: string;
  cluster_type: "broad_pillar" | "medium" | "long_tail" | "seasonal";
  central_entity: string;
  satellite_target: number;
  layers: ClusterLayer;
  score: "strong" | "medium" | "weak_real" | "no_data" | "critical_gap";
  score_reasoning: string;
  geo_score: "high" | "medium" | "low";
  geo_recommendation: string;
  gsc_impressions: number;
  gsc_clicks: number;
  internal_links_to_category: boolean;
  merge_candidates: string[];
}

// ============================================================
// Semantic merge
// ============================================================

function semanticMerge(clusters: RawCluster[]): (RawCluster & { merged_from?: string[]; opportunity_score?: number })[] {
  const merged = new Map<string, RawCluster & { merged_from?: string[] }>();
  const mergeMap = new Map<string, string>();

  for (const c of clusters) {
    if (c.merge_candidates?.length > 0) {
      for (const candidate of c.merge_candidates) {
        if (clusters.find(x => x.cluster_name === candidate) && !mergeMap.has(c.cluster_name)) {
          mergeMap.set(candidate, c.cluster_name);
        }
      }
    }
  }

  for (const c of clusters) {
    const parent = mergeMap.get(c.cluster_name);
    if (parent && merged.has(parent)) {
      const p = merged.get(parent)!;
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

// ============================================================
// Opportunity score
// ============================================================

function calculateOpportunityScore(c: RawCluster): number {
  const impressions = c.gsc_impressions || 0;
  const commercialWeight = c.layers?.category_url ? 1.5 : 1.0;
  const existing = (c.layers?.satellite_urls?.length || 0) + (c.layers?.pillar_url ? 1 : 0);
  const target = c.satellite_target || 5;
  const coverageRatio = Math.max(0.1, existing / target);
  const pillarFactor = c.layers?.pillar_status === "missing" ? 2.0 : c.layers?.pillar_status === "weak" ? 1.5 : 1.0;
  const geoMult = c.geo_score === "low" && impressions > 10000 ? 1.3 : 1.0;
  return Math.round((impressions * commercialWeight) / coverageRatio * pillarFactor * geoMult);
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, period = "3m", topN = 100, sitemapUrl, step } = body;

    // ---- STEP 1: SCAN (GSC-first) ----
    if (step === "scan" || !step) {
      const session = await auth().catch(() => null);
      if (!session?.accessToken) {
        return NextResponse.json({ error: "Conecte o Google Search Console primeiro" }, { status: 401 });
      }

      let gscSiteUrl = siteUrl;
      if (!gscSiteUrl) {
        const sites = await getGSCSites(session.accessToken);
        if (sites.length > 0) gscSiteUrl = sites[0].siteUrl;
      }
      if (!gscSiteUrl) {
        return NextResponse.json({ error: "Nenhum site encontrado no GSC" }, { status: 400 });
      }

      const { startDate, endDate } = getDateRange(period);

      // Fetch all blog URLs from GSC
      const rows = await getSearchAnalytics(session.accessToken, gscSiteUrl, {
        startDate,
        endDate,
        dimensions: ["query", "page"],
        rowLimit: 25000,
      }) as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];

      // Filter to blog URLs only
      const blogRows = rows.filter((r) => {
        const page = r.keys?.[1] || "";
        return page.includes("/blog/") || page.includes("/artigo/") || page.includes("/post/");
      });

      // Aggregate by page
      const pageMap = new Map<string, BlogUrl>();
      for (const r of blogRows) {
        const page = r.keys?.[1] || "";
        const query = r.keys?.[0] || "";
        if (!pageMap.has(page)) {
          const slug = page.split("/").filter(Boolean).pop() || "";
          pageMap.set(page, {
            url: page,
            title: slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            impressions: 0,
            clicks: 0,
            position: 0,
            topQueries: [],
          });
        }
        const entry = pageMap.get(page)!;
        entry.impressions += r.impressions || 0;
        entry.clicks += r.clicks || 0;
        entry.topQueries.push({ query, impressions: r.impressions || 0, position: r.position || 0 });
      }

      // Calculate avg position per page
      for (const entry of pageMap.values()) {
        entry.topQueries.sort((a, b) => b.impressions - a.impressions);
        if (entry.topQueries.length > 0) {
          entry.position = entry.topQueries[0].position;
        }
        entry.topQueries = entry.topQueries.slice(0, 5);
      }

      // Sort by impressions, take top N
      const allBlogUrls = Array.from(pageMap.values())
        .sort((a, b) => b.impressions - a.impressions);
      const topUrls = allBlogUrls.slice(0, Math.min(topN, 200));

      // Gap detection (if sitemap provided)
      let gaps = { zeroVisibility: [] as string[], sitemapOrphans: [] as string[] };
      if (sitemapUrl) {
        try {
          const sitemapUrls = await parseSitemap(sitemapUrl);
          const sitemapBlogUrls = sitemapUrls
            .map((u: SitemapUrl) => u.loc)
            .filter((url: string) => url.includes("/blog/") || url.includes("/artigo/") || url.includes("/post/"));

          const gscUrlSet = new Set(allBlogUrls.map(u => u.url.replace(/\/$/, "").toLowerCase()));
          const sitemapUrlSet = new Set(sitemapBlogUrls.map((u: string) => u.replace(/\/$/, "").toLowerCase()));

          gaps.zeroVisibility = [...sitemapUrlSet].filter(u => !gscUrlSet.has(u));
          gaps.sitemapOrphans = [...gscUrlSet].filter(u => !sitemapUrlSet.has(u));
        } catch (e) {
          console.warn("[content-intelligence] Sitemap gap detection failed:", e);
        }
      }

      // Split into batches of 25
      const batchSize = 25;
      const batches: BlogUrl[][] = [];
      for (let i = 0; i < topUrls.length; i += batchSize) {
        batches.push(topUrls.slice(i, i + batchSize));
      }

      return NextResponse.json({
        step: "scan_complete",
        totalUrls: allBlogUrls.length,
        analyzingUrls: topUrls.length,
        totalBatches: batches.length,
        batches: batches.map((b, i) => ({ index: i, urls: b })),
        gaps,
      });
    }

    // ---- STEP 2: ANALYZE BATCH (Gemini) ----
    if (step === "analyze_batch") {
      const { urls, batchIndex, totalBatches } = body.batchData;

      const urlSummaries = urls.map((u: BlogUrl) => {
        const topQ = u.topQueries?.slice(0, 3).map((q: { query: string; impressions: number }) => `${q.query}(${q.impressions})`).join(", ") || "-";
        return `${u.title} | ${u.url} | ${topQ} | ${u.impressions}imp ${u.clicks}cli`;
      }).join("\n");

      const rawText = await callGemini({
        systemPrompt: "You are an SEO analyst. Respond with valid JSON only.",
        userPrompt: `Classifique estas ${urls.length} URLs em clusters temáticos SEO (lote ${batchIndex + 1}/${totalBatches}).

URLS:
${urlSummaries}

Agrupe por tema semântico amplo. NÃO fragmente em micro-clusters.

JSON:
{"classificacoes":[{"url":"string","title":"string","cluster":"string","entidade":"string","intencao":"informacional|comercial|transacional","impressoes":0,"cliques":0}]}

IMPORTANTE: Escape todas as aspas duplas dentro de valores string com \\. Nunca use quebras de linha dentro de valores string. Títulos de produtos devem ter aspas escapadas.
APENAS JSON.`,
        maxOutputTokens: 16000,
        temperature: 0.2,
      });

      // Debug logging
      console.error("[CI-DEBUG] Raw response length:", rawText.length);
      console.error("[CI-DEBUG] First 500 chars:", rawText.slice(0, 500));
      console.error("[CI-DEBUG] Last 200 chars:", rawText.slice(-200));
      console.error("[CI-DEBUG] responseMimeType active:", true);

      // Check for truncated response
      const trimmed = rawText.trim();
      if (!trimmed.endsWith("}") && !trimmed.endsWith("]")) {
        throw new Error("Resposta truncada — reduza o número de URLs no slider e tente novamente.");
      }

      // Sanitize control characters before parsing
      const sanitized = rawText
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\t/g, " ")
        .trim();

      let parsed: { classificacoes: unknown[] };
      try {
        parsed = parseGeminiJSON<{ classificacoes: unknown[] }>(sanitized);
      } catch (e) {
        if (e instanceof SyntaxError) {
          const match = e.message.match(/position (\d+)/);
          const pos = match ? parseInt(match[1]) : -1;
          console.error("[content-intelligence] JSON SyntaxError at position", pos, "Raw:", rawText.slice(0, 200));
          throw new Error("Resposta truncada ou malformada. Tente reduzir o número de URLs.");
        }
        throw e;
      }

      return NextResponse.json({
        step: "batch_complete",
        batchIndex,
        classifications: parsed.classificacoes || [],
      });
    }

    // ---- STEP 3: MERGE + FINAL ANALYSIS (Gemini) ----
    if (step === "merge") {
      const { classifications, gaps } = body.batchData;

      // Group by cluster
      const clusterMap: Record<string, { entidade: string; urls: { url: string; title: string; intencao: string }[]; impressoes: number; cliques: number }> = {};
      for (const c of classifications as { cluster: string; entidade: string; url: string; title: string; intencao: string; impressoes: number; cliques: number }[]) {
        if (!clusterMap[c.cluster]) clusterMap[c.cluster] = { entidade: c.entidade, urls: [], impressoes: 0, cliques: 0 };
        clusterMap[c.cluster].urls.push({ url: c.url, title: c.title, intencao: c.intencao });
        clusterMap[c.cluster].impressoes += c.impressoes || 0;
        clusterMap[c.cluster].cliques += c.cliques || 0;
      }

      const clusterList = Object.entries(clusterMap).map(([name, d]) => ({
        nome: name, entidade: d.entidade, urls: d.urls, total_urls: d.urls.length,
        impressoes: d.impressoes, cliques: d.cliques,
      }));

      const rawText = await callGemini({
        systemPrompt: "You are a senior SEO strategist. Respond with valid JSON only.",
        userPrompt: `Analise estes ${clusterList.length} clusters de blog e gere diagnóstico estratégico completo.

CLUSTERS:
${JSON.stringify(clusterList)}

Para CADA cluster retorne:
1. cluster_name, cluster_type (broad_pillar|medium|long_tail|seasonal), central_entity
2. satellite_target (dinâmico: broad=8-15, medium=4-8, long_tail=1-3, seasonal=2-4)
3. layers: { category_url, pillar_url, pillar_status (exists|missing|weak), satellite_urls, missing_satellites (títulos específicos, max 5) }
4. score: strong|medium|weak_real|critical_gap
5. score_reasoning, geo_score (high|medium|low), geo_recommendation (em português)
6. gsc_impressions, gsc_clicks, internal_links_to_category, merge_candidates

TAMBÉM gere:
- executive_summary: 2-3 frases sobre situação geral (em português)
- priority_queue: top 5 clusters por oportunidade, cada com: cluster, reason, action (Criar pillar|Expandir|Otimizar GEO|Corrigir links|Criar do zero)

JSON: {"clusters":[...],"executive_summary":"","priority_queue":[{"cluster":"","reason":"","action":""}]}`,
        maxOutputTokens: 8000,
        temperature: 0.2,
      });

      const parsed = parseGeminiJSON<{ clusters: RawCluster[]; executive_summary?: string; priority_queue?: { cluster: string; reason: string; action: string }[] }>(rawText);

      // Post-processing
      let clusters = parsed.clusters || [];
      clusters = semanticMerge(clusters);

      // Calculate opportunity scores
      const scored = clusters.map(c => ({
        ...c,
        opportunity_score: calculateOpportunityScore(c),
      }));

      // Sort and separate
      const active = scored.filter(c => c.score !== "no_data").sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
      const toValidate = scored.filter(c => c.score === "no_data");

      // Summary
      const resumo = {
        total_urls: classifications.length,
        total_clusters: active.length,
        critical_gaps: active.filter(c => c.score === "critical_gap").length,
        overall_geo: active.length > 0
          ? active.filter(c => c.geo_score === "high").length > active.length / 2 ? "high" : active.filter(c => c.geo_score === "low").length > active.length / 2 ? "low" : "medium"
          : "N/A",
        zero_visibility: gaps?.zeroVisibility?.length || 0,
        sitemap_orphans: gaps?.sitemapOrphans?.length || 0,
      };

      return NextResponse.json({
        step: "complete",
        analysis: {
          clusters: active,
          to_validate: toValidate,
          priority_queue: parsed.priority_queue || [],
          executive_summary: parsed.executive_summary || "",
          resumo,
          gaps: gaps || { zeroVisibility: [], sitemapOrphans: [] },
        },
        analyzedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Step inválido" }, { status: 400 });
  } catch (error) {
    console.error("[content-intelligence] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    // User-friendly error messages
    if (message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({ error: "GEMINI_API_KEY não configurada. Adicione a chave nas variáveis de ambiente do Vercel." }, { status: 400 });
    }
    if (message.includes("HTTP 4")) {
      return NextResponse.json({ error: "Erro de autenticação com a API Gemini. Verifique sua chave." }, { status: 400 });
    }
    if (message.includes("resposta vazia") || message.includes("SAFETY")) {
      return NextResponse.json({ error: "A IA bloqueou a resposta. Tente reduzir o número de URLs." }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
