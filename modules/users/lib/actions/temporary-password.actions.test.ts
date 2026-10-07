import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  changeTemporaryPassword: vi.fn(),
  getTemporaryPasswordState: vi.fn(),
}));

vi.mock("../services/temporary-password.services", () => serviceMocks);

import {
  changeTemporaryPasswordAction,
  getTemporaryPasswordStateAction,
} from "./temporary-password.actions";

describe("temporary-password actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates and strips confirmation before calling the service", async () => {
    serviceMocks.changeTemporaryPassword.mockResolvedValue({ success: true, data: {} });
    await changeTemporaryPasswordAction({
      currentPassword: "temporary-password",
      newPassword: "new-password",
      confirmPassword: "new-password",
      userId: "another-user",
    });
    expect(serviceMocks.changeTemporaryPassword).toHaveBeenCalledWith({
      currentPassword: "temporary-password",
      newPassword: "new-password",
    });
  });

  it("rejects reuse, mismatch and malformed input at the action boundary", async () => {
    for (const input of [
      { currentPassword: "same-password", newPassword: "same-password", confirmPassword: "same-password" },
      { currentPassword: "temporary-password", newPassword: "new-password", confirmPassword: "other-password" },
      { currentPassword: "temporary-password", newPassword: "short", confirmPassword: "short" },
    ]) {
      await expect(changeTemporaryPasswordAction(input)).resolves.toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(serviceMocks.changeTemporaryPassword).not.toHaveBeenCalled();
  });

  it("exposes only the minimal activation state service", async () => {
    serviceMocks.getTemporaryPasswordState.mockResolvedValue({
      success: true,
      data: { status: "required", purpose: "activation", expiresAt: "2026-09-12T00:00:00.000Z" },
    });
    await expect(getTemporaryPasswordStateAction()).resolves.toMatchObject({
      success: true,
      data: { status: "required" },
    });
  });
});
