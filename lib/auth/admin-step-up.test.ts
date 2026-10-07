import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireActiveSession: vi.fn(),
  verifyPassword: vi.fn(),
  verifyTOTP: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("./session", () => ({ requireActiveSession: mocks.requireActiveSession }));
vi.mock("./auth", () => ({
  auth: { api: { verifyPassword: mocks.verifyPassword, verifyTOTP: mocks.verifyTOTP } },
}));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: { session: { findMany: mocks.findMany, deleteMany: mocks.deleteMany } },
}));

import { ADMIN_STEP_UP_MAX_AGE_SECONDS, verifyAdminStepUp } from "./admin-step-up";

const requestHeaders = new Headers({ cookie: "session=opaque" });
const session = {
  session: { id: "session-current", createdAt: new Date() },
  user: {
    id: "admin-1",
    role: "platform_admin",
    adminProfile: "owner",
    status: "active",
    twoFactorEnabled: true,
    twoFactorVerified: true,
    temporaryPasswordChangeRequired: false,
  },
};

describe("administrator step-up", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.requireActiveSession.mockResolvedValue(session);
    mocks.verifyPassword.mockResolvedValue({ status: true });
    mocks.verifyTOTP.mockResolvedValue({ token: "opaque" });
    mocks.findMany
      .mockResolvedValueOnce([{ id: "session-current" }])
      .mockResolvedValueOnce([{ id: "session-current" }]);
  });

  it("uses Better Auth for password and TOTP without creating another session", async () => {
    await expect(verifyAdminStepUp({ password: "not-logged", totpCode: "123456" }))
      .resolves.toMatchObject({ success: true, session });
    expect(mocks.verifyPassword).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: { password: "not-logged" },
    });
    expect(mocks.verifyTOTP).toHaveBeenCalledWith({
      headers: requestHeaders,
      body: { code: "123456", trustDevice: false },
    });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("requires a recent definitive session before checking secrets", async () => {
    mocks.requireActiveSession.mockResolvedValue({
      ...session,
      session: {
        ...session.session,
        createdAt: new Date(Date.now() - (ADMIN_STEP_UP_MAX_AGE_SECONDS + 1) * 1_000),
      },
    });
    await expect(verifyAdminStepUp({ password: "not-logged", totpCode: "123456" }))
      .resolves.toMatchObject({ success: false, code: "RECENT_SESSION_REQUIRED", actorUserId: "admin-1" });
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.verifyTOTP).not.toHaveBeenCalled();
  });

  it("removes and rejects an unexpected replacement session", async () => {
    mocks.findMany.mockReset();
    mocks.findMany
      .mockResolvedValueOnce([{ id: "session-current" }])
      .mockResolvedValueOnce([{ id: "session-current" }, { id: "session-extra" }]);
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    await expect(verifyAdminStepUp({ password: "not-logged", totpCode: "123456" }))
      .resolves.toMatchObject({ success: false, code: "INTERNAL_ERROR", actorUserId: "admin-1" });
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["session-extra"] } },
    });
  });
});
