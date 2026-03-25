import { prisma } from "@/lib/db";
import type { ActionStatus, PriorityLabel } from "@prisma/client";

export const actionQueueRepository = {
  async create(data: {
    clientId: string;
    categoryWatchId?: string;
    trackedQueryId?: string;
    priorityScore: number;
    priorityLabel: PriorityLabel;
    actionType: string;
    actionTitle: string;
    actionDescription: string;
    source: string;
  }) {
    return prisma.actionQueue.create({ data });
  },

  async findByClient(clientId: string, status?: ActionStatus) {
    return prisma.actionQueue.findMany({
      where: {
        clientId,
        ...(status && { status }),
      },
      include: {
        categoryWatch: true,
        trackedQuery: true,
      },
      orderBy: { priorityScore: "desc" },
      take: 20,
    });
  },

  async findAllOpen() {
    return prisma.actionQueue.findMany({
      where: { status: "OPEN" },
      include: {
        client: true,
        categoryWatch: true,
        trackedQuery: true,
      },
      orderBy: { priorityScore: "desc" },
    });
  },

  async updateStatus(id: string, status: ActionStatus) {
    return prisma.actionQueue.update({ where: { id }, data: { status } });
  },
};
