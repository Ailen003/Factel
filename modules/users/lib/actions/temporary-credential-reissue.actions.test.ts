import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  reissueTemporaryCredential: vi.fn(),
  confirmTemporaryCredentialDelivery: vi.fn(),
}));

vi.mock("../services/temporary-credential-reissue.services", () => services);

import {
  confirmTemporaryCredentialDeliveryAction,
  reissueTemporaryCredentialAction,
} from "./temporary-credential-reissue.actions";

describe("temporary credential administrative actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a confirmed structured reissue and strips an irrelevant empty note", async () => {
    services.reissueTemporaryCredential.mockResolvedValue({ success: true, data: {} });
    await reissueTemporaryCredentialAction({
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: 0,
      reason: "forgotten_password",
      reasonNote: "",
      confirmed: true,
    });
    expect(services.reissueTemporaryCredential).toHaveBeenCalledWith({
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: 0,
      reason: "forgotten_password",
      reasonNote: undefined,
      confirmed: true,
    });
  });

  it.each([
    {
      targetUserId: "trial-1",
      operationId: "not-a-uuid",
      expectedVersion: 0,
      reason: "forgotten_password",
      confirmed: true,
    },
    {
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: -1,
      reason: "forgotten_password",
      confirmed: true,
    },
    {
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: 0,
      reason: "other",
      confirmed: true,
    },
    {
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: 0,
      reason: "forgotten_password",
      reasonNote: "private detail",
      confirmed: true,
    },
    {
      targetUserId: "trial-1",
      operationId: "3f44d98d-d250-47d1-aa24-1e7221616e61",
      expectedVersion: 0,
      reason: "forgotten_password",
      confirmed: false,
    },
  ])("rejects malformed or unconfirmed reissue input", async (input) => {
    await expect(reissueTemporaryCredentialAction(input)).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(services.reissueTemporaryCredential).not.toHaveBeenCalled();
  });

  it("validates delivery confirmation at the action boundary", async () => {
    services.confirmTemporaryCredentialDelivery.mockResolvedValue({
      success: true,
      data: {},
    });
    await confirmTemporaryCredentialDeliveryAction({
      issuanceId: "issuance-1",
      expectedVersion: 1,
      channel: "secure_message",
      confirmed: true,
    });
    expect(services.confirmTemporaryCredentialDelivery).toHaveBeenCalledWith({
      issuanceId: "issuance-1",
      expectedVersion: 1,
      channel: "secure_message",
      confirmed: true,
    });
  });
});
