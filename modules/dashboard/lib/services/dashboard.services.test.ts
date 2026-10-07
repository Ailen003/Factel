import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

const recentRow = {
  id: "request-a",
  title: "Router",
  description: "Install a router",
  serviceType: "INSTALLATION",
  priority: "HIGH",
  status: "IN_PROGRESS",
  preferredSchedule: "Tomorrow",
  serviceAddress: "Main Street",
  nextSteps: "Confirm time",
  version: 2,
  createdAt: new Date("2026-09-01T10:00:00Z"),
  updatedAt: new Date("2026-09-06T12:30:00Z"),
  client: { id: "client-a", name: "Ana" },
};

const tx = {
  workspace: { findFirst: vi.fn() },
  session: { findFirst: vi.fn() },
  client: { count: vi.fn() },
  serviceRequest: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
};

describe("workspace dashboard reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolve.mockResolvedValue({
      session: {
        session: { id: "session-a" },
        user: { id: "user-a", role: "trial_user" },
      },
      workspace: { id: "workspace-a" },
    });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-a" });
    tx.session.findFirst.mockResolvedValue({ id: "session-a" });
    tx.client.count.mockResolvedValue(4);
    tx.serviceRequest.count.mockResolvedValue(7);
    tx.serviceRequest.groupBy.mockResolvedValue([
      { status: "PENDING", _count: { _all: 2 } },
      { status: "IN_PROGRESS", _count: { _all: 3 } },
      { status: "RESOLVED", _count: { _all: 2 } },
    ]);
    tx.serviceRequest.findMany.mockResolvedValue([recentRow]);
  });

  it("returns a serializable dashboard snapshot scoped to the current workspace", async () => {
    const { getDashboardMetrics } = await import("./dashboard.services");

    const response = await getDashboardMetrics();

    expect(response).toEqual({
      success: true,
      data: {
        totalClients: 4,
        totalRequests: 7,
        requestSummary: {
          total: 7,
          pending: 2,
          in_progress: 3,
          resolved: 2,
          cancelled: 0,
        },
        recentRequests: [{
          ...recentRow,
          serviceType: "installation",
          priority: "high",
          status: "in_progress",
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-06T12:30:00.000Z",
        }],
      },
    });
    const where = { workspaceId: "workspace-a" };
    expect(tx.client.count).toHaveBeenCalledWith({ where });
    expect(tx.serviceRequest.count).toHaveBeenCalledWith({ where });
    expect(tx.serviceRequest.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    expect(tx.serviceRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 5,
    }));
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("maps authorization and database failures to stable, non-sensitive errors", async () => {
    const { getDashboardMetrics } = await import("./dashboard.services");

    mocks.resolve.mockRejectedValueOnce(new AuthError("UNAUTHENTICATED"));
    expect(await getDashboardMetrics()).toEqual({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tx.client.count.mockRejectedValueOnce(
      new Error("Private database details: ana@example.com"),
    );
    const response = await getDashboardMetrics();
    expect(response).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "INTERNAL_ERROR" },
    });
    expect(JSON.stringify([response, log.mock.calls])).not.toContain("ana@example.com");
  });
});
