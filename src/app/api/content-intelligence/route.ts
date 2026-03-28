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
  const clusterSummary: Record<string, { entidade: string; urls: number; impressoes: number; cliques: number; intencoes: string[] }> = {};

  for (const c of allClassifications) {
    if (!clusterSummary[c.cluster]) {
      clusterSummary[c.cluster] = { entidade: c.entidade, urls: 0, impressoes: 0, cliques: 0, intencoes: [] };
    }
    clusterSummary[c.cluster].urls++;
    clusterSummary[c.cluster].impressoes += c.impressoes;
    clusterSummary[c.cluster].cliques += c.cliques;
    clusterSummary[c.cluster].intencoes.push(c.intencao);
  }

  const summary = Object.entries(clusterSummary)
    .map(([name, d]) => `${name}: ${d.urls} URLs, ${d.impressoes} imp, ${d.cliques} cli, entidade: ${d.entidade}`)
    .join("\n");

  const classJson = JSON.stringify(allClassifications);

  const prompt = `Você é especialista em SEO e autoridade temática. Dado estes clusters já classificados, gere o diagnóstico final.

CLUSTERS IDENTIFICADOS:
${summary}

CLASSIFICAÇÕES COMPLETAS:
${classJson}

Gere JSON com diagnóstico, gaps, oportunidades e priorização:
{
  "clusters": [
    {
      "nome_cluster": "string",
      "entidade_principal": "string",
      "score": "forte|medio|fraco",
      "total_urls": number,
      "urls": [{ "url": "string", "title": "string", "tipo_intencao": "string" }],
      "metricas": { "impressoes": number, "cliques": number, "ctr_medio": number },
      "cobertura": { "atual": number, "ideal": number, "gap": number },
      "diagnostico": "string",
      "oportunidades": ["string"]
    }
  ],
  "priorizacao": [{ "cluster": "string", "motivo": "string" }],
  "resumo": { "total_urls": number, "total_clusters": number, "clusters_fortes": number, "clusters_medios": number, "clusters_fracos": number }
}

Score: forte = impressões altas + CTR bom + cobertura ampla. fraco = pouca cobertura ou baixa tração.
Gap: ideal = URLs necessárias pra cobrir o tema. atual = existentes. gap = ideal - atual.
APENAS JSON válido.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });
  return (message.content.find((b) => b.type === "text") as { text: string })?.text ?? "";
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
      } catch {}

      if (!analysis) return NextResponse.json({ error: "Falha ao gerar análise final" }, { status: 500 });

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
