import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSitemap } from "@/lib/sitemap/parser";
import { getSearchAnalytics, getGSCSites, matchDomainToGSCSite, getDateRange } from "@/lib/gsc-client";
import { analyzeWithAI } from "@/lib/ai-client";
import type { SitemapUrl } from "@/types/category-map";

function filterBlogUrls(urls: SitemapUrl[]): SitemapUrl[] {
  return urls.filter((u) => {
    try {
      const path = new URL(u.loc).pathname;
      if (path === "/" || path === "") return false;
      if (/\.(xml|json|jpg|png|pdf)$/i.test(path)) return false;
      // Skip non-content pages
      if (/\/(cart|checkout|account|login|admin|sitemap|politica|termos|contato)\b/i.test(path)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

function extractTitle(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  } catch {
    return url;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sitemapUrl, siteUrl, period = "3m" } = body;

    if (!sitemapUrl) {
      return NextResponse.json({ error: "Informe a URL do sitemap" }, { status: 400 });
    }

    // Parse sitemap
    let allUrls;
    try {
      allUrls = await parseSitemap(sitemapUrl);
    } catch (e) {
      return NextResponse.json({
        error: `Erro ao buscar sitemap: ${e instanceof Error ? e.message : "falha"}`,
      }, { status: 400 });
    }

    const blogUrls = filterBlogUrls(allUrls);
    if (blogUrls.length === 0) {
      return NextResponse.json({ error: "Nenhuma URL de conteúdo encontrada" }, { status: 400 });
    }

    // Limit to 100 URLs to avoid timeout
    const limitedUrls = blogUrls.slice(0, 100);

    // Try to get GSC data
    const session = await auth().catch(() => null);

    interface UrlData {
      url: string;
      title: string;
      slug: string;
      queries: { query: string; impressions: number; clicks: number; ctr: number; position: number }[];
      totalImpressions: number;
      totalClicks: number;
    }

    const urlDataList: UrlData[] = [];

    if (session?.accessToken) {
      let gscSiteUrl = siteUrl;
      if (!gscSiteUrl) {
        const sites = await getGSCSites(session.accessToken);
        const domain = new URL(limitedUrls[0].loc).hostname.replace(/^www\./, "");
        gscSiteUrl = matchDomainToGSCSite(domain, sites);
      }

      if (gscSiteUrl) {
        const { startDate, endDate } = getDateRange(period);
        const rows = await getSearchAnalytics(session.accessToken, gscSiteUrl, {
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: 5000,
        }) as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];

        for (const blogUrl of limitedUrls) {
          const urlNorm = blogUrl.loc.replace(/\/$/, "").toLowerCase();
          const slug = new URL(blogUrl.loc).pathname.split("/").filter(Boolean).pop() || "";

          const matching = rows.filter((r) => {
            const page = (r.keys?.[1] || "").replace(/\/$/, "").toLowerCase();
            return page === urlNorm;
          });

          const queries = matching
            .map((r) => ({
              query: r.keys?.[0] || "",
              impressions: r.impressions || 0,
              clicks: r.clicks || 0,
              ctr: r.ctr || 0,
              position: r.position || 0,
            }))
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 5);

          urlDataList.push({
            url: blogUrl.loc,
            title: extractTitle(blogUrl.loc),
            slug,
            queries,
            totalImpressions: matching.reduce((s, r) => s + (r.impressions || 0), 0),
            totalClicks: matching.reduce((s, r) => s + (r.clicks || 0), 0),
          });
        }
      }
    }

    // If no GSC data, still create URL list with zero metrics
    if (urlDataList.length === 0) {
      for (const blogUrl of limitedUrls) {
        const slug = new URL(blogUrl.loc).pathname.split("/").filter(Boolean).pop() || "";
        urlDataList.push({
          url: blogUrl.loc,
          title: extractTitle(blogUrl.loc),
          slug,
          queries: [],
          totalImpressions: 0,
          totalClicks: 0,
        });
      }
    }

    // Build prompt for Claude
    const urlSummaries = urlDataList.map((u) => {
      const topQueries = u.queries.length > 0
        ? u.queries.map((q) => `"${q.query}" (${q.impressions} imp, ${q.clicks} cli, pos ${q.position.toFixed(1)})`).join("; ")
        : "(sem dados GSC)";
      return `URL: ${u.url}\nTitle: ${u.title}\nSlug: ${u.slug}\nQueries: ${topQueries}\nImpr: ${u.totalImpressions} | Clicks: ${u.totalClicks}`;
    }).join("\n---\n");

    const prompt = `Você é um sistema especialista em análise de conteúdo SEO orientado a cluster, entidade e autoridade temática.

Analise as ${urlDataList.length} URLs abaixo e gere clusters temáticos com diagnóstico estratégico.

URLS E DADOS:
${urlSummaries}

REGRAS:
- Agrupar por cluster temático (NÃO analisar URL isoladamente)
- Cada URL pertence a UM cluster principal
- Cada cluster tem UMA entidade dominante
- Evitar clusters genéricos ("outros", "diversos")
- Pensar como Google (intenção + semântica)
- Classificar intenção: informacional, comercial, transacional, navegacional
- Score do cluster: forte (CTR alto + muitas URLs + muitas impressões), medio, fraco
- Identificar gaps: subtemas esperados vs existentes
- Diagnóstico: por que forte/médio/fraco
- Priorizar: do mais crítico para menos

FORMATO JSON OBRIGATÓRIO:
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
      "diagnostico": "string - explicação clara de por que é forte/médio/fraco",
      "oportunidades": ["string - conteúdo específico que falta"]
    }
  ],
  "priorizacao": [
    { "cluster": "string", "motivo": "string" }
  ],
  "resumo": {
    "total_urls": number,
    "total_clusters": number,
    "clusters_fortes": number,
    "clusters_medios": number,
    "clusters_fracos": number
  }
}

Responda APENAS com JSON válido. Sem markdown, sem explicação fora do JSON.`;

    const aiResponse = await analyzeWithAI(prompt);

    // Parse AI response
    let analysis;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        return NextResponse.json({ error: "Falha ao parsear resposta da IA" }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: "Resposta da IA não é JSON válido" }, { status: 500 });
    }

    return NextResponse.json({
      analysis,
      urlCount: urlDataList.length,
      hasGscData: urlDataList.some((u) => u.queries.length > 0),
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[content-intelligence] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
