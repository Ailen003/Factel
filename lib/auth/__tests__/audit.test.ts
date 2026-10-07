import { beforeEach, describe, expect, it, vi } from "vitest";

const createAuditEvent = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { auditEvent: { create: createAuditEvent } },
}));

describe("writeAuthAudit", () => {
  beforeEach(() => {
    createAuditEvent.mockReset();
  });

  it("propagates persistence failures", async () => {
    const persistenceError = new Error("audit unavailable");
    createAuditEvent.mockRejectedValueOnce(persistenceError);
    const { writeAuthAudit } = await import("../audit");

    await expect(writeAuthAudit({
      action: "user.create",
      outcome: "SUCCEEDED",
    })).rejects.toBe(persistenceError);
  });

  it("uses the injected transaction writer and correlation id", async () => {
    const transactionCreate = vi.fn().mockResolvedValue({ id: "audit-1" });
    const { writeAuthAudit } = await import("../audit");

    await writeAuthAudit({
      action: "user.role_change",
      actorUserId: "admin-1",
      targetUserId: "user-1",
      outcome: "SUCCEEDED",
      correlationId: "correlation-1",
    }, { auditEvent: { create: transactionCreate } } as never);

    expect(transactionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ correlationId: "correlation-1" }),
    });
    expect(createAuditEvent).not.toHaveBeenCalled();
  });
});
