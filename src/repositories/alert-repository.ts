import { prisma } from "@/lib/db";
import type { AlertSeverity, AlertType, AlertStatus } from "@prisma/client";

export const alertRepository = {
  async create(data: {
    clientId: string;
    categoryWatchId?: string;
    trackedQueryId?: string;
    severity: AlertSeverity;
    type: AlertType;
    title: string;
    message: string;
    recommendedAction?: string;
    metadataJson?: unknown;
  }) {
    return prisma.alert.create({
      data: {
        ...data,
        metadataJson: data.metadataJson as object,
      },
    });
  },

  async findByClient(
    clientId: string,
    filters?: {
      severity?: AlertSeverity;
      status?: AlertStatus;
      type?: AlertType;
    }
  ) {
    return prisma.alert.findMany({
      where: {
        clientId,
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
      },
      include: {
        categoryWatch: true,
        trackedQuery: true,
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
  },

  async findOpenAlerts() {
    return prisma.alert.findMany({
      where: { status: "OPEN" },
      include: {
        client: true,
        categoryWatch: true,
        trackedQuery: true,
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    });
  },

  async updateStatus(id: string, status: AlertStatus) {
    return prisma.alert.update({ where: { id }, data: { status } });
  },

  async countByClientAndSeverity(clientId: string) {
    const results = await prisma.alert.groupBy({
      by: ["severity"],
      where: { clientId, status: "OPEN" },
      _count: true,
    });
    return results.reduce(
      (acc, r) => ({ ...acc, [r.severity]: r._count }),
      { INFO: 0, WARNING: 0, CRITICAL: 0 } as Record<string, number>
    );
  },
};
