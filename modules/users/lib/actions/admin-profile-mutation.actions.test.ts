import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  promoteUserToOperator: vi.fn(),
  demoteOperatorToTrialUser: vi.fn(),
}));

vi.mock("../services/admin-profile-mutation.services", () => mocks);

import {
  demoteOperatorToTrialUserAction,
  promoteUserToOperatorAction,
} from "./admin-profile-mutation.actions";

const valid = {
  operationId: "c675eab5-ef07-40df-bc50-74c9b4dd5e98",
  targetUserId: "dzZHCRedv6VH3N52v2IbUwKaObtYI7xz",
  expectedVersion: 0,
  confirmed: true,
};

describe("administrator profile mutation actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates validated confirmed promotion and demotion inputs", async () => {
    mocks.promoteUserToOperator.mockResolvedValue({ success: true, data: {} });
    mocks.demoteOperatorToTrialUser.mockResolvedValue({ success: true, data: {} });

    await promoteUserToOperatorAction(valid);
    await demoteOperatorToTrialUserAction(valid);

    expect(mocks.promoteUserToOperator).toHaveBeenCalledWith(valid);
    expect(mocks.demoteOperatorToTrialUser).toHaveBeenCalledWith(valid);
  });

  it.each([
    { ...valid, operationId: "not-a-uuid" },
    { ...valid, targetUserId: "" },
    { ...valid, targetUserId: "x".repeat(192) },
    { ...valid, expectedVersion: -1 },
    { ...valid, confirmed: false },
  ])("rejects invalid or unconfirmed input", async (input) => {
    await expect(promoteUserToOperatorAction(input)).resolves.toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.promoteUserToOperator).not.toHaveBeenCalled();
  });
});
