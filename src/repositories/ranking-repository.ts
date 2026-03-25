import { prisma } from "@/lib/db";

export const rankingRepository = {
  async create(data: {
    trackedQueryId: string;
    yourPosition: number | null;
    yourUrl: string | null;
    topCompetitorDomain: string | null;
  }) {
    return prisma.rankingHistory.create({ data });
  },

  async getHistory(trackedQueryId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.rankingHistory.findMany({
      where: {
        trackedQueryId,
        checkedAt: { gte: since },
      },
      orderBy: { checkedAt: "asc" },
    });
  },

  async getLatest(trackedQueryId: string) {
    return prisma.rankingHistory.findFirst({
      where: { trackedQueryId },
      orderBy: { checkedAt: "desc" },
    });
  },
};
