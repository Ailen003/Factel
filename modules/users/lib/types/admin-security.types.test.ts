import { describe, expect, it } from "vitest";
import {
  initiateOwnershipTransferSchema,
  operatorMfaRecoverySchema,
  resolveOwnershipTransferSchema,
} from "./admin-security.types";

const stepUp = {
  operationId: "c675eab5-ef07-40df-bc50-74c9b4dd5e98",
  password: "current-password",
  totpCode: "123456",
  confirmed: true,
};

describe("administrative security schemas", () => {
  it("normalizes an empty operational reference", () => {
    expect(operatorMfaRecoverySchema.parse({
      ...stepUp,
      targetUserId: "operator-1",
      expectedAdminProfileVersion: 2,
      reason: "lost_all_factors",
      operationalReference: "  ",
    }).operationalReference).toBeUndefined();
  });

  it.each([
    { ...stepUp, totpCode: "12345" },
    { ...stepUp, confirmed: false },
    { ...stepUp, operationId: "not-a-uuid" },
    { ...stepUp, unexpected: "field" },
  ])("rejects malformed step-up input", (invalidStepUp) => {
    expect(resolveOwnershipTransferSchema.safeParse({
      ...invalidStepUp,
      transferId: "transfer-1",
    }).success).toBe(false);
  });

  it("requires both optimistic versions when initiating", () => {
    expect(initiateOwnershipTransferSchema.safeParse({
      ...stepUp,
      targetUserId: "operator-1",
      expectedOwnerVersion: 1,
    }).success).toBe(false);
  });
});
