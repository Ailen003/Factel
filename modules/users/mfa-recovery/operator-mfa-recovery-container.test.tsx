import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { User } from "../lib/types/user.types";
import { OperatorMfaRecoveryContainer } from "./operator-mfa-recovery-container";

const state = vi.hoisted(() => ({
  recoverOperator: vi.fn(async (_input: unknown) => false),
  reset: vi.fn(),
  isLoading: false,
}));

vi.mock("../lib/hooks/use-admin-security", () => ({
  useAdminSecurity: () => ({
    recoverOperator: state.recoverOperator,
    isLoading: state.isLoading,
    error: null,
    recoveryResult: null,
    reset: state.reset,
  }),
}));

const operator: User = {
  id: "operator-2",
  email: "operator@example.com",
  fullName: "Operations Admin",
  role: "platform_admin",
  adminProfile: "operator",
  adminProfileVersion: 7,
  twoFactorEnabled: true,
  twoFactorVerified: true,
  status: "suspended",
  locale: "en",
  initialCreditAllocation: 0,
  temporaryPasswordChangeRequired: false,
  temporaryPasswordExpiresAt: null,
  temporaryPasswordPurpose: null,
  temporaryCredentialVersion: 0,
  latestTemporaryCredentialIssuance: null,
  trialActivatedAt: null,
  trialExpiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
};

function renderContainer() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OperatorMfaRecoveryContainer
        user={operator}
        operationId="11111111-1111-4111-8111-111111111111"
        onClose={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

describe("operator MFA recovery container", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    state.recoverOperator.mockClear();
    state.reset.mockClear();
    state.isLoading = false;
  });

  it("submits only the typed recovery contract and explains the security effects", async () => {
    renderContainer();
    expect(screen.getByText(/Every operator session will be revoked immediately/i)).toBeTruthy();
    expect(screen.getByText(/suspension remains in place/i)).toBeTruthy();
    expect(screen.getByText(/No previous secret or backup code/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Operational reference"), { target: { value: "  OPS-104  " } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "owner-password" } });
    fireEvent.change(screen.getByLabelText("Current authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Reset MFA and revoke sessions" }));

    await waitFor(() => expect(state.recoverOperator).toHaveBeenCalledWith({
      operationId: "11111111-1111-4111-8111-111111111111",
      targetUserId: "operator-2",
      expectedAdminProfileVersion: 7,
      reason: "lost_all_factors",
      operationalReference: "OPS-104",
      password: "owner-password",
      totpCode: "123456",
      confirmed: true,
    }));
  });

  it("disables cancellation and submission while pending", () => {
    state.isLoading = true;
    renderContainer();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Resetting MFA/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rotates operationId and clears step-up secrets after a denied attempt", async () => {
    const nextOperationId = "33333333-3333-4333-8333-333333333333";
    const randomUuid = vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(nextOperationId);
    state.recoverOperator.mockResolvedValue(false);
    renderContainer();

    const password = screen.getByLabelText("Current password") as HTMLInputElement;
    const totp = screen.getByLabelText("Current authenticator code") as HTMLInputElement;
    fireEvent.change(password, { target: { value: "first-password" } });
    fireEvent.change(totp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Reset MFA and revoke sessions" }));
    await waitFor(() => expect(state.recoverOperator).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(password.value).toBe(""));
    expect(totp.value).toBe("");

    fireEvent.change(password, { target: { value: "second-password" } });
    fireEvent.change(totp, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset MFA and revoke sessions" }));
    await waitFor(() => expect(state.recoverOperator).toHaveBeenCalledTimes(2));
    expect(state.recoverOperator.mock.calls[1][0]).toMatchObject({
      operationId: nextOperationId,
      password: "second-password",
      totpCode: "654321",
    });
    randomUuid.mockRestore();
  });
});
