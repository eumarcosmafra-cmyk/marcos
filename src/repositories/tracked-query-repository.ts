import { prisma } from "@/lib/db";

export const trackedQueryRepository = {
  async findByCategoryWatch(categoryWatchId: string) {
    return prisma.trackedQuery.findMany({
      where: { categoryWatchId },
      orderBy: { isPrimary: "desc" },
    });
  },

  async findPrimaryByCategoryWatch(categoryWatchId: string) {
    return prisma.trackedQuery.findFirst({
      where: { categoryWatchId, isPrimary: true },
    });
  },

  async findAllPrimary() {
    return prisma.trackedQuery.findMany({
      where: {
        isPrimary: true,
        categoryWatch: { isActive: true },
      },
      include: {
        categoryWatch: { include: { client: true } },
      },
    });
  },

  async findAllActive() {
    return prisma.trackedQuery.findMany({
      where: { categoryWatch: { isActive: true } },
      include: {
        categoryWatch: { include: { client: true } },
      },
    });
  },

  async upsertCluster(
    categoryWatchId: string,
    primaryQuery: string,
    relatedQueries: string[]
  ) {
    // Delete existing queries for this category
    await prisma.trackedQuery.deleteMany({ where: { categoryWatchId } });

    // Create primary
    const primary = await prisma.trackedQuery.create({
      data: {
        categoryWatchId,
        query: primaryQuery,
        isPrimary: true,
        source: "GSC",
      },
    });

    // Create related
    const related = await Promise.all(
      relatedQueries.slice(0, 5).map((query) =>
        prisma.trackedQuery.create({
          data: {
            categoryWatchId,
            query,
            isPrimary: false,
            source: "GSC",
          },
        })
      )
    );

    return { primary, related };
  },

  async findById(id: string) {
    return prisma.trackedQuery.findUnique({
      where: { id },
      include: {
        categoryWatch: { include: { client: true } },
      },
    });
  },
};
