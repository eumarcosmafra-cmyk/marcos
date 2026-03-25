import { prisma } from "@/lib/db";

export const competitorRepository = {
  async findMonitored(trackedQueryId: string) {
    return prisma.competitorPage.findMany({
      where: { trackedQueryId, isMonitored: true, isActive: true },
      include: {
        snapshots: { orderBy: { capturedAt: "desc" }, take: 2 },
      },
    });
  },

  async upsertFromSerp(
    trackedQueryId: string,
    competitors: { domain: string; url: string; position: number }[]
  ) {
    const results = [];
    for (const comp of competitors) {
      const page = await prisma.competitorPage.upsert({
        where: {
          trackedQueryId_domain_url: {
            trackedQueryId,
            domain: comp.domain,
            url: comp.url,
          },
        },
        update: {
          lastSeenAt: new Date(),
          isActive: true,
          isMonitored: comp.position <= 5,
        },
        create: {
          trackedQueryId,
          domain: comp.domain,
          url: comp.url,
          isMonitored: comp.position <= 5,
        },
      });
      results.push(page);
    }
    return results;
  },

  async createSnapshot(
    competitorPageId: string,
    data: {
      title?: string | null;
      h1?: string | null;
      metaDescription?: string | null;
      contentLength?: number;
      faqCount?: number;
      rawHtmlHash?: string;
    }
  ) {
    return prisma.competitorSnapshot.create({
      data: {
        competitorPageId,
        title: data.title ?? undefined,
        h1: data.h1 ?? undefined,
        metaDescription: data.metaDescription ?? undefined,
        contentLength: data.contentLength,
        faqCount: data.faqCount,
        rawHtmlHash: data.rawHtmlHash,
      },
    });
  },

  async getLatestSnapshot(competitorPageId: string) {
    return prisma.competitorSnapshot.findFirst({
      where: { competitorPageId },
      orderBy: { capturedAt: "desc" },
    });
  },

  async findAllMonitored() {
    return prisma.competitorPage.findMany({
      where: {
        isMonitored: true,
        isActive: true,
        trackedQuery: { categoryWatch: { isActive: true } },
      },
      include: {
        trackedQuery: {
          include: { categoryWatch: { include: { client: true } } },
        },
        snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    });
  },
};
