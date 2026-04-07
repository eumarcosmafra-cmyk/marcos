import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth, isAuthError } from "@/lib/require-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGSCSites, getSiteOverview, getSearchAnalytics, matchDomainToGSCSite } from "@/lib/gsc-client";
import { getGA4EcommerceData } from "@/lib/ga4-client";

interface QueryPageRow {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface OrganicPage {
  pagePath: string;
  pageTitle: string;
  sessions: number;
  revenue: number;
  transactions: number;
  addToCarts: number;
}

interface ItemRow {
  itemName: string;
  itemCategory: string;
  itemsViewed: number;
  addToCarts: number;
  itemsPurchased: number;
  revenue: number;
  revenuePerItem: number;
}

function classifyBlock(path: string, revenue: number): "produto" | "categoria" | "conteudo" | "marca" {
  const p = path.toLowerCase();
  if (/\/(blog|artigo|post|guia|dica)/.test(p)) return "conteudo";
  if (/\/(categoria|colecao|collection|\/c\/|\/cat\/)/.test(p)) return "categoria";
  if (/\/(produto|\/p\/|\/item)/.test(p)) return "produto";
  if (p === "/" || /\/(sobre|institucional|brand)/.test(p)) return "marca";
  const segs = p.split("/").filter(Boolean);
  if (segs.length === 1 && revenue > 0) return "produto";
  return "produto";
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (isAuthError(authResult)) return authResult;

  try {
    const session = await auth();
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Faça login novamente" }, { status: 401 });
    }
    const { id } = await params;
    const accessToken = session.accessToken;

    const body = await request.json().catch(() => ({}));
    const days = Math.max(1, Math.min(365, parseInt(body.days || "90")));

    const client = await prisma.client.findUnique({
      where: { id },
      select: { id: true, domain: true, ga4PropertyId: true },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (days - 1));
    const prevStartDate = prevStart.toISOString().split("T")[0];
    const prevEndDate = prevEnd.toISOString().split("T")[0];

    // ----- GSC -----
    let gsc: {
      siteUrl: string;
      totalClicks: number;
      totalImpressions: number;
      avgCtr: number;
      avgPosition: number;
      topQueries: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
      topPages: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
      dailyData: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
      queryPageRows: QueryPageRow[];
    } | null = null;
    let gscPrevClicks = 0;
    let gscPrevImpressions = 0;

    try {
      const sites = await getGSCSites(accessToken);
      const siteUrl = matchDomainToGSCSite(client.domain, sites);
      if (siteUrl) {
        const overview = await getSiteOverview(accessToken, siteUrl, startDate, endDate);
        const queryPageRaw = await getSearchAnalytics(accessToken, siteUrl, {
          startDate,
          endDate,
          dimensions: ["query", "page"],
          rowLimit: 500,
        });
        const queryPageRows: QueryPageRow[] = (queryPageRaw as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]).map((r) => ({
          query: r.keys?.[0] || "",
          page: r.keys?.[1] || "",
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          ctr: r.ctr || 0,
          position: r.position || 0,
        }));

        gsc = {
          siteUrl,
          totalClicks: overview.totalClicks,
          totalImpressions: overview.totalImpressions,
          avgCtr: overview.avgCtr,
          avgPosition: overview.avgPosition,
          topQueries: overview.topQueries.slice(0, 10),
          topPages: overview.topPages.slice(0, 20),
          dailyData: overview.dailyData,
          queryPageRows,
        };

        try {
          const prev = await getSiteOverview(accessToken, siteUrl, prevStartDate, prevEndDate);
          gscPrevClicks = prev.totalClicks;
          gscPrevImpressions = prev.totalImpressions;
        } catch (e) {
          console.error("[snapshot] GSC previous period error:", e);
        }
      }
    } catch (e) {
      console.error("[snapshot] GSC error:", e);
    }

    // ----- GA4 -----
    let ga4: { revenue: number; transactions: number; sessions: number; users: number; itemsViewed: number; addedToCart: number } | null = null;
    let ga4Pages: OrganicPage[] = [];
    let ga4Items: ItemRow[] = [];
    let ga4PrevRevenue = 0;

    if (client.ga4PropertyId) {
      try {
        const ecom = await getGA4EcommerceData(accessToken, client.ga4PropertyId, { startDate, endDate });
        ga4 = {
          revenue: ecom.revenue,
          transactions: ecom.transactions,
          sessions: ecom.sessions,
          users: ecom.users,
          itemsViewed: ecom.itemsViewed,
          addedToCart: ecom.addedToCart,
        };

        try {
          const prevEcom = await getGA4EcommerceData(accessToken, client.ga4PropertyId, { startDate: prevStartDate, endDate: prevEndDate });
          ga4PrevRevenue = prevEcom.revenue;
        } catch (e) {
          console.error("[snapshot] GA4 prev error:", e);
        }

        const oauth2 = new google.auth.OAuth2();
        oauth2.setCredentials({ access_token: accessToken });
        const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2 });

        // Organic pages
        const pageRes = await analyticsdata.properties.runReport({
          property: client.ga4PropertyId,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
            metrics: [
              { name: "sessions" },
              { name: "purchaseRevenue" },
              { name: "transactions" },
              { name: "addToCarts" },
            ],
            dimensionFilter: {
              filter: {
                fieldName: "sessionDefaultChannelGroup",
                stringFilter: { matchType: "EXACT", value: "Organic Search" },
              },
            },
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: "100",
          },
        });
        ga4Pages = (pageRes.data.rows || []).map((row) => ({
          pagePath: row.dimensionValues?.[0]?.value || "",
          pageTitle: row.dimensionValues?.[1]?.value || "",
          sessions: parseInt(row.metricValues?.[0]?.value || "0"),
          revenue: parseFloat(row.metricValues?.[1]?.value || "0"),
          transactions: parseInt(row.metricValues?.[2]?.value || "0"),
          addToCarts: parseInt(row.metricValues?.[3]?.value || "0"),
        }));

        // Items
        const itemRes = await analyticsdata.properties.runReport({
          property: client.ga4PropertyId,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: "itemName" }, { name: "itemCategory" }],
            metrics: [
              { name: "itemsViewed" },
              { name: "addToCarts" },
              { name: "itemsPurchased" },
              { name: "purchaseRevenue" },
            ],
            dimensionFilter: {
              filter: {
                fieldName: "sessionDefaultChannelGroup",
                stringFilter: { matchType: "EXACT", value: "Organic Search" },
              },
            },
            orderBys: [{ metric: { metricName: "purchaseRevenue" }, desc: true }],
            limit: "50",
          },
        });
        ga4Items = (itemRes.data.rows || []).map((row) => {
          const dims = row.dimensionValues || [];
          const mets = row.metricValues || [];
          const itemsPurchased = parseInt(mets[2]?.value || "0");
          const revenue = parseFloat(mets[3]?.value || "0");
          return {
            itemName: dims[0]?.value || "(sem nome)",
            itemCategory: dims[1]?.value || "(sem categoria)",
            itemsViewed: parseInt(mets[0]?.value || "0"),
            addToCarts: parseInt(mets[1]?.value || "0"),
            itemsPurchased,
            revenue,
            revenuePerItem: itemsPurchased > 0 ? revenue / itemsPurchased : 0,
          };
        });
      } catch (e) {
        console.error("[snapshot] GA4 error:", e);
      }
    }

    // ----- Dashboard computation -----
    const queryPageRows = gsc?.queryPageRows || [];

    // Products: match GA4 items with GSC by slug appearing in URL
    const products = ga4Items.slice(0, 30).map((item, i) => {
      const slug = slugify(item.itemName);
      const matched = queryPageRows.filter((q) => slug.length > 3 && q.page.toLowerCase().includes(slug));
      const clicks = matched.reduce((s, m) => s + m.clicks, 0);
      const impressions = matched.reduce((s, m) => s + m.impressions, 0);
      const ctr = impressions > 0 ? clicks / impressions : 0;
      const position = matched.length > 0 ? matched.reduce((s, m) => s + m.position, 0) / matched.length : 0;
      return {
        rank: i + 1,
        itemName: item.itemName,
        itemCategory: item.itemCategory,
        clicks,
        impressions,
        ctr,
        position,
        revenue: item.revenue,
        revenueDelta: 0,
        revenuePerItem: item.revenuePerItem,
        addToCarts: item.addToCarts,
      };
    });

    // Categories aggregation from items
    const totalItemsRevenue = ga4Items.reduce((s, i) => s + i.revenue, 0);
    const catMap = new Map<string, { revenue: number; clicks: number; ctr: number; n: number }>();
    for (const item of ga4Items) {
      const key = item.itemCategory || "(sem categoria)";
      const prod = products.find((p) => p.itemName === item.itemName);
      const c = catMap.get(key) || { revenue: 0, clicks: 0, ctr: 0, n: 0 };
      c.revenue += item.revenue;
      if (prod) {
        c.clicks += prod.clicks;
        c.ctr += prod.ctr;
        c.n += 1;
      }
      catMap.set(key, c);
    }
    const categories = Array.from(catMap.entries())
      .map(([name, v]) => ({
        name,
        revenue: v.revenue,
        revenuePct: totalItemsRevenue > 0 ? (v.revenue / totalItemsRevenue) * 100 : 0,
        clicks: v.clicks,
        ctr: v.n > 0 ? v.ctr / v.n : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Blocks classification from organic pages
    const blocks: Record<"produto" | "categoria" | "conteudo" | "marca", { clicks: number; revenue: number; ctr: number; impressions: number }> = {
      produto: { clicks: 0, revenue: 0, ctr: 0, impressions: 0 },
      categoria: { clicks: 0, revenue: 0, ctr: 0, impressions: 0 },
      conteudo: { clicks: 0, revenue: 0, ctr: 0, impressions: 0 },
      marca: { clicks: 0, revenue: 0, ctr: 0, impressions: 0 },
    };
    for (const page of ga4Pages) {
      const block = classifyBlock(page.pagePath, page.revenue);
      blocks[block].revenue += page.revenue;
      const matched = queryPageRows.filter((q) => q.page.includes(page.pagePath));
      const clicks = matched.reduce((s, m) => s + m.clicks, 0);
      const impressions = matched.reduce((s, m) => s + m.impressions, 0);
      blocks[block].clicks += clicks;
      blocks[block].impressions += impressions;
    }
    for (const k of Object.keys(blocks) as (keyof typeof blocks)[]) {
      const b = blocks[k];
      b.ctr = b.impressions > 0 ? b.clicks / b.impressions : 0;
    }

    // Highlights
    const topGain = products.length > 0 ? products[0] : null;
    const lowCtrCount = products.filter((p) => p.impressions > 1000 && p.ctr < 0.02).length;
    const biggestGap = products
      .filter((p) => p.impressions > 1000 && p.ctr < 0.02)
      .sort((a, b) => b.impressions - a.impressions)[0];

    const highlights = {
      topGanho: topGain ? `${topGain.itemName} é o produto líder de receita orgânica (${topGain.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })})` : "Sem dados de produtos suficientes",
      maiorGap: biggestGap ? `${biggestGap.itemName} tem ${biggestGap.impressions.toLocaleString("pt-BR")} impressões mas apenas ${(biggestGap.ctr * 100).toFixed(1)}% de CTR` : "Nenhum gap crítico identificado",
      baixaCtr: `${lowCtrCount} produto${lowCtrCount === 1 ? "" : "s"} com mais impressão do que clique esperado`,
    };

    // KPIs
    const totalClicks = gsc?.totalClicks || 0;
    const totalImpressions = gsc?.totalImpressions || 0;
    const totalRevenue = ga4?.revenue || 0;
    const kpis = {
      clicks: totalClicks,
      clicksDelta: gscPrevClicks > 0 ? ((totalClicks - gscPrevClicks) / gscPrevClicks) * 100 : 0,
      impressions: totalImpressions,
      impressionsDelta: gscPrevImpressions > 0 ? ((totalImpressions - gscPrevImpressions) / gscPrevImpressions) * 100 : 0,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      revenue: totalRevenue,
      revenueDelta: ga4PrevRevenue > 0 ? ((totalRevenue - ga4PrevRevenue) / ga4PrevRevenue) * 100 : 0,
      itemsViewed: ga4?.itemsViewed || 0,
      addToCarts: ga4?.addedToCart || 0,
    };

    const dashboard = { kpis, products, categories, blocks, highlights };

    const snapshot = {
      period: { startDate, endDate, days },
      gsc: gsc
        ? {
            siteUrl: gsc.siteUrl,
            totalClicks: gsc.totalClicks,
            totalImpressions: gsc.totalImpressions,
            avgCtr: gsc.avgCtr,
            avgPosition: gsc.avgPosition,
            topQueries: gsc.topQueries,
            topPages: gsc.topPages,
          }
        : null,
      ga4,
      ga4Pages: ga4Pages.slice(0, 30),
      ga4Items: ga4Items.slice(0, 30),
      dashboard,
    };

    const updated = await prisma.client.update({
      where: { id },
      data: { analyticsSnapshot: snapshot as object, snapshotUpdatedAt: new Date() },
      select: { snapshotUpdatedAt: true },
    });

    return NextResponse.json({ ok: true, snapshotUpdatedAt: updated.snapshotUpdatedAt });
  } catch (error) {
    console.error("[clients/[id]/snapshot] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
