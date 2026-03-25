import { prisma } from "@/lib/db";

export const clientRepository = {
  async findAll() {
    return prisma.client.findMany({
      include: { categoryWatches: { where: { isActive: true } } },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: {
        categoryWatches: {
          where: { isActive: true },
          include: { trackedQueries: true },
        },
      },
    });
  },

  async findByDomain(domain: string) {
    return prisma.client.findUnique({ where: { domain } });
  },

  async upsertByDomain(name: string, domain: string) {
    return prisma.client.upsert({
      where: { domain },
      update: { name },
      create: { name, domain },
    });
  },

  async create(name: string, domain: string) {
    return prisma.client.create({ data: { name, domain } });
  },

  async delete(id: string) {
    return prisma.client.delete({ where: { id } });
  },
};
