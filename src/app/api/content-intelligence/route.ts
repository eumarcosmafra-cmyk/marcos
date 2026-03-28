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

  const prompt = `Classifique estas ${urls.length} URLs em clusters temáticos SEO (batch ${batchIndex + 1}/${totalBatches}).

URLS:
${urlSummaries}

Para cada URL, retorne apenas a classificação. JSON:
{
  "classificacoes": [
    { "url": "string", "title": "string", "cluster": "string", "entidade": "string", "intencao": "informacional|comercial|transacional", "impressoes": number, "cliques": number }
  ]
}

Regras: agrupar por tema semântico, entidade = conceito central, evitar clusters genéricos. APENAS JSON.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  return (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
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

  const prompt = `Dado estes ${clusterList.length} clusters de conteúdo SEO já classificados, gere diagnóstico.

${JSON.stringify(clusterList)}

Para cada cluster: score (forte/medio/fraco), cobertura (atual/ideal/gap), diagnóstico curto, e 2-3 oportunidades de conteúdo.
Priorizar do mais crítico.

JSON:
{"clusters":[{"nome_cluster":"","entidade_principal":"","score":"forte|medio|fraco","total_urls":0,"urls":[{"url":"","title":"","tipo_intencao":""}],"metricas":{"impressoes":0,"cliques":0,"ctr_medio":0},"cobertura":{"atual":0,"ideal":0,"gap":0},"diagnostico":"","oportunidades":[""]}],"priorizacao":[{"cluster":"","motivo":""}],"resumo":{"total_urls":${allClassifications.length},"total_clusters":${clusterList.length},"clusters_fortes":0,"clusters_medios":0,"clusters_fracos":0}}

APENAS JSON.`;

  console.log("[content-intelligence] Merge prompt length:", prompt.length, "clusters:", clusterList.length);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
  console.log("[content-intelligence] Merge response length:", text.length, "stop_reason:", message.stop_reason);
  return text;
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
            entidade_principal: d.entidade,
            score: d.impressoes > 1000 ? "forte" : d.impressoes > 100 ? "medio" : "fraco",
            total_urls: d.urls.length,
            urls: d.urls,
            metricas: { impressoes: d.impressoes, cliques: d.cliques, ctr_medio: d.impressoes > 0 ? d.cliques / d.impressoes : 0 },
            cobertura: { atual: d.urls.length, ideal: Math.max(d.urls.length + 2, 5), gap: Math.max(0, 5 - d.urls.length) },
            diagnostico: d.impressoes > 1000 ? "Cluster com boa tração" : "Cluster com cobertura limitada",
            oportunidades: ["Expandir cobertura com mais conteúdos"],
          })),
          priorizacao: Object.entries(clusterMap)
            .sort((a, b) => a[1].impressoes - b[1].impressoes)
            .map(([name]) => ({ cluster: name, motivo: "Baixa cobertura ou tração" })),
          resumo: {
            total_urls: classifications.length,
            total_clusters: Object.keys(clusterMap).length,
            clusters_fortes: 0,
            clusters_medios: 0,
            clusters_fracos: 0,
          },
        };
        const scores = analysis.clusters.map((c: { score: string }) => c.score);
        analysis.resumo.clusters_fortes = scores.filter((s: string) => s === "forte").length;
        analysis.resumo.clusters_medios = scores.filter((s: string) => s === "medio").length;
        analysis.resumo.clusters_fracos = scores.filter((s: string) => s === "fraco").length;
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
