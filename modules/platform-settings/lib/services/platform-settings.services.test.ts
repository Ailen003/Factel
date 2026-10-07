import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  requireAdminCapability: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/admin-authorization", () => ({
  requireAdminCapability: mocks.requireAdminCapability,
}));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));
vi.mock("@/lib/persistence/prisma", () => ({
  prisma: {
    platformSettings: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
    },
    $transaction: mocks.transaction,
  },
}));

import {
  getPlatformSettings,
  getPublicAccessContactSettings,
  pauseAccessRequests,
  resolveAccessContactEmail,
  resumeAccessRequests,
  updatePlatformContactEmail,
} from "./platform-settings.services";

const owner = { user: { id: "owner-1", adminProfile: "owner" } };
const operator = { user: { id: "operator-1", adminProfile: "operator" } };
const current = {
  accessContactEmail: "access@example.com",
  accessRequestsEnabled: true,
  version: 4,
  updatedAt: new Date("2026-09-09T12:00:00.000Z"),
};

function transactionClient(settings: typeof current | null = current) {
  return {
    platformSettings: {
      findUnique: vi.fn().mockResolvedValue(settings),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe("platform settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminCapability.mockResolvedValue(owner);
    mocks.writeAuthAudit.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("keeps public reads unchanged and never exposes the contact email", async () => {
    mocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        accessContactEmail: "demo@example.com",
        accessRequestsEnabled: true,
      });

    await expect(getPublicAccessContactSettings()).resolves.toEqual({
      success: true,
      data: { available: false },
    });
    await expect(getPublicAccessContactSettings()).resolves.toEqual({
      success: true,
      data: { available: true },
    });
    expect(mocks.requireAdminCapability).not.toHaveBeenCalled();
  });

  it("does not reveal the contact email while requests are disabled", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(resolveAccessContactEmail()).resolves.toMatchObject({
      success: false,
      error: { code: "CONTACT_NOT_CONFIGURED" },
    });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "public-access", accessRequestsEnabled: true },
      select: { accessContactEmail: true },
    });
  });

  it("audits privileged settings reads before returning profile-derived UI booleans", async () => {
    mocks.requireAdminCapability.mockResolvedValue(operator);
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await getPlatformSettings();

    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("platform.settings.read");
    expect(result).toMatchObject({
      success: true,
      data: {
        version: 4,
        canUpdateContact: false,
        canPause: true,
        canResume: false,
      },
    });
    expect(result).not.toHaveProperty("data.capabilities");
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform.settings.read",
        outcome: "SUCCEEDED",
      }),
      transaction,
    );
  });

  it("fails closed when the privileged read audit fails", async () => {
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));
    mocks.writeAuthAudit.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(getPlatformSettings()).resolves.toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("updates contact email with an owner-only version fence and transactional audit", async () => {
    const saved = {
      ...current,
      accessContactEmail: "new@example.com",
      version: 5,
    };
    const transaction = transactionClient();
    transaction.platformSettings.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(saved);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await updatePlatformContactEmail({
      accessContactEmail: "new@example.com",
      expectedVersion: 4,
    });

    expect(mocks.requireAdminCapability).toHaveBeenCalledWith("platform.settings.update");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(transaction.platformSettings.updateMany).toHaveBeenCalledWith({
      where: { id: "public-access", version: 4 },
      data: {
        accessContactEmail: "new@example.com",
        version: { increment: 1 },
        updatedByUserId: "owner-1",
      },
    });
    expect(result).toMatchObject({ success: true, data: { version: 5 } });
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform.settings.update",
        outcome: "SUCCEEDED",
      }),
      transaction,
    );
  });

  it("denies operators from contact updates at the capability boundary", async () => {
    mocks.requireAdminCapability.mockRejectedValueOnce(new AuthError("FORBIDDEN"));

    await expect(updatePlatformContactEmail({
      accessContactEmail: "new@example.com",
      expectedVersion: 4,
    })).resolves.toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("allows operator pause and requires owner resume capabilities", async () => {
    const paused = { ...current, accessRequestsEnabled: false, version: 5 };
    const pauseTransaction = transactionClient();
    pauseTransaction.platformSettings.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(paused);
    const resumeTransaction = transactionClient(paused);
    resumeTransaction.platformSettings.findUnique
      .mockResolvedValueOnce(paused)
      .mockResolvedValueOnce({ ...current, version: 6 });
    mocks.requireAdminCapability
      .mockResolvedValueOnce(operator)
      .mockResolvedValueOnce(owner);
    mocks.transaction
      .mockImplementationOnce(async (operation) => operation(pauseTransaction))
      .mockImplementationOnce(async (operation) => operation(resumeTransaction));

    const pauseResult = await pauseAccessRequests({ expectedVersion: 4 });
    const resumeResult = await resumeAccessRequests({ expectedVersion: 5 });

    expect(pauseResult).toMatchObject({
      success: true,
      data: { accessRequestsEnabled: false, version: 5 },
    });
    expect(resumeResult).toMatchObject({
      success: true,
      data: { accessRequestsEnabled: true, version: 6 },
    });
    expect(mocks.requireAdminCapability).toHaveBeenNthCalledWith(
      1,
      "platform.admission.pause",
    );
    expect(mocks.requireAdminCapability).toHaveBeenNthCalledWith(
      2,
      "platform.admission.resume",
    );
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform.admission.pause" }),
      pauseTransaction,
    );
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "platform.admission.resume" }),
      resumeTransaction,
    );
  });

  it("returns SETTINGS_CONFLICT for a true stale write and audits the denial", async () => {
    const transaction = transactionClient();
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await pauseAccessRequests({ expectedVersion: 3 });

    expect(result).toMatchObject({
      success: false,
      error: { code: "SETTINGS_CONFLICT" },
    });
    expect(transaction.platformSettings.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform.admission.pause",
        outcome: "DENIED",
        safeMetadata: { reason: "SETTINGS_CONFLICT", expectedVersion: 3 },
      }),
      transaction,
    );
  });

  it("treats identical desired state as a replay without mutation or duplicate audit", async () => {
    const transaction = transactionClient(current);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));

    const result = await resumeAccessRequests({ expectedVersion: 1 });

    expect(result).toMatchObject({
      success: true,
      data: { accessRequestsEnabled: true, version: 4 },
    });
    expect(transaction.platformSettings.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAuthAudit).not.toHaveBeenCalled();
  });

  it("rolls back the settings response when mutation audit fails", async () => {
    const saved = { ...current, accessRequestsEnabled: false, version: 5 };
    const transaction = transactionClient();
    transaction.platformSettings.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(saved);
    mocks.transaction.mockImplementation(async (operation) => operation(transaction));
    mocks.writeAuthAudit.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(pauseAccessRequests({ expectedVersion: 4 })).resolves.toMatchObject({
      success: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });
});
