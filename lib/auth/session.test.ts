import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findWorkspace: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findUser },
    workspace: { findUnique: mocks.findWorkspace },
  },
}));

import { requireActiveSession, resolveCurrentWorkspace } from "./session";

const sessionRecord = {
  id: "session-1",
  userId: "trial-1",
  token: "token-1",
  expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  createdAt: new Date("2026-09-09T00:00:00.000Z"),
  updatedAt: new Date("2026-09-09T00:00:00.000Z"),
};

function setActor(input: {
  status?: "active" | "suspended";
  temporary?: boolean;
  temporaryExpiresAt?: Date | null;
  temporaryPurpose?: "activation" | "recovery";
  sessionRole?: "trial_user" | "platform_admin";
  sessionAdminProfile?: "owner" | "operator" | null;
  currentRole?: "trial_user" | "platform_admin";
  currentAdminProfile?: "owner" | "operator" | null;
  mfaEnabled?: boolean;
  mfaVerified?: boolean;
}) {
  const user = {
    id: "trial-1",
    email: "trial@example.com",
    name: "Trial User",
    image: null,
    role: input.currentRole ?? "trial_user",
    adminProfile: input.currentAdminProfile ?? null,
    status: input.status ?? "active",
    locale: "en",
    temporaryPasswordChangeRequired: input.temporary ?? false,
    temporaryPasswordExpiresAt: input.temporaryExpiresAt ?? null,
    temporaryPasswordPurpose: input.temporary
      ? (input.temporaryPurpose ?? "activation")
      : null,
    trialActivatedAt: input.temporary ? null : new Date("2026-09-09T00:00:00.000Z"),
    trialExpiresAt: input.temporary ? null : new Date("2026-09-23T00:00:00.000Z"),
    initialCreditAllocation: 10,
    twoFactorEnabled:
      input.mfaEnabled ?? (input.currentRole === "platform_admin"),
    twoFactor: {
      verified: input.mfaVerified ?? (input.currentRole === "platform_admin"),
    },
  };
  mocks.getSession.mockResolvedValue({
    session: sessionRecord,
    user: {
      ...user,
      role: input.sessionRole ?? user.role,
      adminProfile: input.sessionAdminProfile ?? user.adminProfile,
    },
  });
  mocks.findUser.mockResolvedValue(user);
}

describe("authoritative application session gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    vi.useRealTimers();
  });

  it("allows an activated account", async () => {
    setActor({});
    await expect(requireActiveSession(new Headers())).resolves.toMatchObject({
      user: { id: "trial-1", temporaryPasswordChangeRequired: false },
    });
  });

  it("blocks every protected boundary while password replacement is pending", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
    setActor({ temporary: true, temporaryExpiresAt: new Date("2026-09-12T00:00:00.000Z") });
    await expect(requireActiveSession(new Headers())).rejects.toMatchObject({
      code: "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
    });
  });

  it("distinguishes an expired credential and a suspended account", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T00:00:00.000Z"));
    setActor({ temporary: true, temporaryExpiresAt: new Date("2026-09-12T00:00:00.000Z") });
    await expect(requireActiveSession(new Headers())).rejects.toMatchObject({
      code: "TEMPORARY_PASSWORD_EXPIRED",
    });

    setActor({ status: "suspended" });
    await expect(requireActiveSession(new Headers())).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
    });
  });

  it("uses the current database role and profile instead of stale session claims", async () => {
    setActor({
      sessionRole: "platform_admin",
      sessionAdminProfile: "owner",
      currentRole: "platform_admin",
      currentAdminProfile: "operator",
    });
    await expect(requireActiveSession(new Headers())).resolves.toMatchObject({
      user: { role: "platform_admin", adminProfile: "operator" },
    });

    setActor({
      sessionRole: "platform_admin",
      sessionAdminProfile: "operator",
      currentRole: "trial_user",
      currentAdminProfile: null,
    });
    await expect(requireActiveSession(new Headers())).resolves.toMatchObject({
      user: { role: "trial_user", adminProfile: null },
    });
  });

  it("blocks a current administrator until both MFA persistence states are verified", async () => {
    setActor({
      currentRole: "platform_admin",
      currentAdminProfile: "owner",
      mfaEnabled: false,
      mfaVerified: false,
    });
    await expect(requireActiveSession(new Headers())).rejects.toMatchObject({
      code: "ADMIN_MFA_ENROLLMENT_REQUIRED",
    });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.mfa.pending_denied",
      outcome: "DENIED",
    }));

    setActor({
      currentRole: "platform_admin",
      currentAdminProfile: "operator",
      mfaEnabled: true,
      mfaVerified: false,
    });
    await expect(requireActiveSession(new Headers())).rejects.toMatchObject({
      code: "ADMIN_MFA_ENROLLMENT_REQUIRED",
    });
  });

  it("resolves only the authenticated user's workspace", async () => {
    setActor({});
    mocks.findWorkspace.mockResolvedValue({ id: "workspace-1", ownerId: "trial-1", lifecycle: "ACTIVE" });
    await expect(resolveCurrentWorkspace(new Headers())).resolves.toMatchObject({
      workspace: { id: "workspace-1", ownerId: "trial-1" },
    });
    expect(mocks.findWorkspace).toHaveBeenCalledWith({
      where: { ownerId: "trial-1" },
      select: { id: true, ownerId: true, lifecycle: true },
    });
  });
});
