import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveSession: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({
  requireActiveSession: mocks.requireActiveSession,
}));
vi.mock("./audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));

import { requireAdminCapability } from "./admin-authorization";

function session(adminProfile: "owner" | "operator" | null, role = "platform_admin") {
  return {
    session: { id: "session-1" },
    user: { id: "actor-1", role, adminProfile },
  };
}

describe("server administrative authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeAuthAudit.mockResolvedValue(undefined);
  });

  it("allows a current owner capability", async () => {
    mocks.requireActiveSession.mockResolvedValue(session("owner"));
    await expect(requireAdminCapability("admin.manage")).resolves.toMatchObject({
      user: { id: "actor-1" },
    });
    expect(mocks.writeAuthAudit).not.toHaveBeenCalled();
  });

  it("audits and denies an operator owner-only capability", async () => {
    mocks.requireActiveSession.mockResolvedValue(session("operator"));
    await expect(requireAdminCapability("platform.admission.resume")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "admin.authorization",
      actorUserId: "actor-1",
      outcome: "DENIED",
      safeMetadata: {
        capability: "platform.admission.resume",
        reason: "FORBIDDEN",
      },
    }));
  });

  it("rejects an administrator without a profile", async () => {
    mocks.requireActiveSession.mockResolvedValue(session(null));
    await expect(requireAdminCapability("trial.read")).rejects.toMatchObject({
      code: "ADMIN_PROFILE_REQUIRED",
    });
  });

  it("fails closed when a mandatory denial audit cannot persist", async () => {
    const auditError = new Error("audit unavailable");
    mocks.requireActiveSession.mockResolvedValue(session("operator"));
    mocks.writeAuthAudit.mockRejectedValue(auditError);
    await expect(requireAdminCapability("admin.manage")).rejects.toBe(auditError);
  });
});
