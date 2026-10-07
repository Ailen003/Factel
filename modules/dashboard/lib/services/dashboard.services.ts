import "server-only";

import { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";
import { resolveCurrentWorkspace } from "@/lib/auth/session";
import type { ServiceResponse } from "@/lib/api-responses";
import {
  assertRecordAccess,
  recordError,
} from "@/lib/records/record-policy";
import type {
  ServiceRequest,
  ServiceRequestSummary,
} from "@/modules/requests/lib/types/service-request.types";
import type { DashboardMetrics } from "../types/dashboard.types";

const recentRequestSelect = {
  id: true,
  title: true,
  description: true,
  serviceType: true,
  priority: true,
  status: true,
  preferredSchedule: true,
  serviceAddress: true,
  nextSteps: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
} satisfies Prisma.ServiceRequestSelect;

type RecentRequestRow = Prisma.ServiceRequestGetPayload<{
  select: typeof recentRequestSelect;
}>;

function mapRecentRequest(row: RecentRequestRow): ServiceRequest {
  return {
    ...row,
    serviceType: row.serviceType.toLowerCase() as ServiceRequest["serviceType"],
    priority: row.priority.toLowerCase() as ServiceRequest["priority"],
    status: row.status.toLowerCase() as ServiceRequest["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function emptyRequestSummary(): ServiceRequestSummary {
  return {
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    cancelled: 0,
  };
}

export async function getDashboardMetrics(): Promise<ServiceResponse<DashboardMetrics>> {
  try {
    const { session, workspace } = await resolveCurrentWorkspace();

    return await prisma.$transaction(async (tx) => {
      await assertRecordAccess(tx, session, workspace.id);

      const totalClients = await tx.client.count({
        where: { workspaceId: workspace.id },
      });
      const totalRequests = await tx.serviceRequest.count({
        where: { workspaceId: workspace.id },
      });
      const statusGroups = await tx.serviceRequest.groupBy({
        by: ["status"],
        where: { workspaceId: workspace.id },
        _count: { _all: true },
      });
      const recentRequests = await tx.serviceRequest.findMany({
        where: { workspaceId: workspace.id },
        select: recentRequestSelect,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 5,
      });

      const requestSummary = emptyRequestSummary();
      requestSummary.total = totalRequests;
      for (const group of statusGroups) {
        const status = group.status.toLowerCase() as keyof Omit<
          ServiceRequestSummary,
          "total"
        >;
        requestSummary[status] = group._count._all;
      }

      return {
        success: true as const,
        data: {
          totalClients,
          totalRequests,
          requestSummary,
          recentRequests: recentRequests.map(mapRecentRequest),
        },
      };
    }, { isolationLevel: "RepeatableRead" });
  } catch (error) {
    return recordError(error);
  }
}
