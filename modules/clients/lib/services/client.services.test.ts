import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";
import { parseClientFilters } from "../types/client.types";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ resolveCurrentWorkspace: mocks.resolve }));
vi.mock("@/lib/persistence/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));

const tx = {
  workspace: { findFirst: vi.fn() },
  session: { findFirst: vi.fn() },
  client: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
};
const client = {
  id: "client-a", name: "Ana", email: "ana@example.com", phone: null,
  company: "Demo", address: null, notes: null, version: 1,
  createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-01T00:00:00Z"),
};

describe("workspace client reads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.resolve.mockResolvedValue({ session: { session: { id: "session-a" }, user: { id: "user-a", role: "trial_user" } }, workspace: { id: "workspace-a" } });
    mocks.transaction.mockImplementation(async (operation) => operation(tx));
    tx.workspace.findFirst.mockResolvedValue({ id: "workspace-a" });
    tx.session.findFirst.mockResolvedValue({ id: "session-a" });
    tx.client.count.mockResolvedValue(6);
    tx.client.findMany.mockResolvedValue([client]);
    tx.client.findFirst.mockResolvedValue(client);
  });

  it("keeps count/list in one scoped snapshot, clamps stale pages, and returns serializable dates", async () => {
    const { getAllClients } = await import("./client.services");
    const response = await getAllClients(parseClientFilters({ page: "99", limit: "5", search: "Ana", sortBy: "name", sortOrder: "asc" }));
    expect(response).toMatchObject({ success: true, data: { clients: [{ id: "client-a", createdAt: "2026-09-01T00:00:00.000Z" }], pagination: { page: 2, limit: 5, total: 6, totalPages: 2 } } });
    const where = { workspaceId: "workspace-a", OR: [
      { name: { contains: "Ana", mode: "insensitive" } },
      { email: { contains: "Ana", mode: "insensitive" } },
      { phone: { contains: "Ana" } },
      { company: { contains: "Ana", mode: "insensitive" } },
    ] };
    expect(tx.client.count).toHaveBeenCalledWith({ where });
    expect(tx.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 5, take: 5, orderBy: [{ name: "asc" }, { id: "asc" }] }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });

  it("scopes details by both ID and current workspace and hides inaccessible records", async () => {
    tx.client.findFirst.mockResolvedValue(null);
    const { getClientById } = await import("./client.services");
    expect(await getClientById("other-workspace-client")).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    expect(tx.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other-workspace-client", workspaceId: "workspace-a" } }));
  });

  it.each(["workspace", "session"] as const)("denies reads when %s becomes inactive or revoked", async (boundary) => {
    tx[boundary].findFirst.mockResolvedValue(null);
    const { getAllClients } = await import("./client.services");
    expect(await getAllClients(parseClientFilters({}))).toMatchObject({ success: false, error: { code: boundary === "workspace" ? "ACCOUNT_INACTIVE" : "UNAUTHENTICATED" } });
    expect(tx.client.count).not.toHaveBeenCalled();
    expect(tx.client.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid inputs and unauthenticated requests without running a query", async () => {
    const { getAllClients, getClientById } = await import("./client.services");
    expect(await getClientById(" ")).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(await getAllClients({ ...parseClientFilters({}), search: "x".repeat(101) })).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    mocks.resolve.mockRejectedValue(new AuthError("UNAUTHENTICATED"));
    expect(await getAllClients(parseClientFilters({}))).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not expose database messages in the response or application logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    tx.client.count.mockRejectedValue(new Error("Private database details: ana@example.com"));
    const { getAllClients } = await import("./client.services");
    const response = await getAllClients(parseClientFilters({}));
    expect(response).toMatchObject({ success: false, error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify([response, log.mock.calls])).not.toContain("ana@example.com");
  });
});
