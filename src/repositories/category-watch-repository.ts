import { prisma } from "@/lib/db";

export const categoryWatchRepository = {
  async findByClient(clientId: string) {
    return prisma.categoryWatch.findMany({
      where: { clientId, isActive: true },
      include: {
        trackedQueries: { orderBy: { isPrimary: "desc" } },
      },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.categoryWatch.findUnique({
      where: { id },
      include: {
        client: true,
        trackedQueries: { orderBy: { isPrimary: "desc" } },
      },
    });
  },

  async create(clientId: string, name: string, targetUrl: string) {
    return prisma.categoryWatch.create({
      data: { clientId, name, targetUrl },
    });
  },

  async deactivate(id: string) {
    return prisma.categoryWatch.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async countByClient(clientId: string) {
    return prisma.categoryWatch.count({
      where: { clientId, isActive: true },
    });
  },

  async findAllActive() {
    return prisma.categoryWatch.findMany({
      where: { isActive: true },
      include: {
        client: true,
        trackedQueries: { where: { isPrimary: true } },
      },
    });
  },
};
