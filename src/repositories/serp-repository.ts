import { prisma } from "@/lib/db";

export const serpRepository = {
  async createSnapshot(
    trackedQueryId: string,
    results: {
      position: number;
      domain: string;
      url: string;
      title: string;
    }[],
    rawJson?: unknown
  ) {
    return prisma.serpSnapshot.create({
      data: {
        trackedQueryId,
        rawJson: rawJson as object,
        results: {
          create: results.map((r, i) => ({
            position: r.position,
            domain: r.domain,
            url: r.url,
            title: r.title,
            isMonitored: i < 5, // top 5 monitored
          })),
        },
      },
      include: { results: { orderBy: { position: "asc" } } },
    });
  },

  async getLatestSnapshot(trackedQueryId: string) {
    return prisma.serpSnapshot.findFirst({
      where: { trackedQueryId },
      orderBy: { checkedAt: "desc" },
      include: { results: { orderBy: { position: "asc" } } },
    });
  },

  async getPreviousSnapshot(trackedQueryId: string) {
    const snapshots = await prisma.serpSnapshot.findMany({
      where: { trackedQueryId },
      orderBy: { checkedAt: "desc" },
      take: 2,
      include: { results: { orderBy: { position: "asc" } } },
    });
    return snapshots[1] || null;
  },

  async getSnapshotHistory(trackedQueryId: string, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.serpSnapshot.findMany({
      where: {
        trackedQueryId,
        checkedAt: { gte: since },
      },
      orderBy: { checkedAt: "asc" },
      include: { results: { orderBy: { position: "asc" } } },
    });
  },
};
