import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  recoverOperatorMfa: vi.fn(),
  initiateOwnershipTransfer: vi.fn(),
  cancelOwnershipTransfer: vi.fn(),
  declineOwnershipTransfer: vi.fn(),
  acceptOwnershipTransfer: vi.fn(),
  getCurrentOwnershipTransfer: vi.fn(),
}));

vi.mock("../services/admin-security.services", () => services);

import {
  acceptOwnershipTransferAction,
  getCurrentOwnershipTransferAction,
  initiateOwnershipTransferAction,
  recoverOperatorMfaAction,
} from "./admin-security.actions";

const stepUp = {
  operationId: "c675eab5-ef07-40df-bc50-74c9b4dd5e98",
  password: "current-password",
  totpCode: "123456",
  confirmed: true,
};

describe("administrative security actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const service of Object.values(services)) {
      service.mockResolvedValue({ success: true, data: {} });
    }
  });

  it("normalizes and delegates operator MFA recovery", async () => {
    await recoverOperatorMfaAction({
      ...stepUp,
      targetUserId: "operator-1",
      expectedAdminProfileVersion: 2,
      reason: "lost_device",
      operationalReference: "  SEC-42  ",
    });
    expect(services.recoverOperatorMfa).toHaveBeenCalledWith({
      ...stepUp,
      targetUserId: "operator-1",
      expectedAdminProfileVersion: 2,
      reason: "lost_device",
      operationalReference: "SEC-42",
    });
  });

  it("rejects invalid secrets and confirmation before the service", async () => {
    await expect(initiateOwnershipTransferAction({
      ...stepUp,
      confirmed: false,
      totpCode: "12345",
      targetUserId: "operator-1",
      expectedOwnerVersion: 1,
      expectedTargetVersion: 1,
    })).resolves.toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(services.initiateOwnershipTransfer).not.toHaveBeenCalled();
  });

  it("delegates recipient resolution and current transfer reads", async () => {
    await acceptOwnershipTransferAction({ ...stepUp, transferId: "transfer-1" });
    await getCurrentOwnershipTransferAction();
    expect(services.acceptOwnershipTransfer).toHaveBeenCalledWith({ ...stepUp, transferId: "transfer-1" });
    expect(services.getCurrentOwnershipTransfer).toHaveBeenCalledTimes(1);
  });
});
