import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import type { User } from "../lib/types/user.types";
import { CredentialReissueContainer } from "./credential-reissue-container";

const hookState = vi.hoisted(() => ({
  reissue: vi.fn().mockResolvedValue(undefined),
  confirmDelivery: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
}));

vi.mock("../lib/hooks/use-temporary-credential-reissue", () => ({
  useTemporaryCredentialReissue: () => ({
    reissue: hookState.reissue,
    confirmDelivery: hookState.confirmDelivery,
    reset: hookState.reset,
    isLoading: false,
    error: null,
    result: null,
  }),
}));

const user: User = {
  id: "trial-1",
  email: "trial@example.com",
  fullName: "Trial User",
  role: "trial_user",
  adminProfile: null,
  adminProfileVersion: 0,
  twoFactorEnabled: false,
  twoFactorVerified: false,
  status: "active",
  locale: "en",
  initialCreditAllocation: 10,
  temporaryPasswordChangeRequired: false,
  temporaryPasswordExpiresAt: null,
  temporaryPasswordPurpose: null,
  temporaryCredentialVersion: 7,
  latestTemporaryCredentialIssuance: null,
  trialActivatedAt: "2026-09-01T00:00:00.000Z",
  trialExpiresAt: "2026-09-15T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("credential reissue container", () => {
  beforeEach(() => {
    hookState.reissue.mockClear();
    hookState.confirmDelivery.mockClear();
    hookState.reset.mockClear();
  });

  it("submits the target version and stable operation ID only after explicit confirmation", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CredentialReissueContainer
          user={user}
          operationId="11111111-1111-4111-8111-111111111111"
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset access" }));
    expect(await screen.findByText("Confirm the operation before continuing.")).toBeTruthy();
    expect(hookState.reissue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Reset access" }));

    await waitFor(() => expect(hookState.reissue).toHaveBeenCalledWith({
      targetUserId: "trial-1",
      operationId: "11111111-1111-4111-8111-111111111111",
      expectedVersion: 7,
      reason: "forgotten_password",
      reasonNote: undefined,
      confirmed: true,
    }));
  });

  it("warns in Spanish that a suspended account is not reactivated", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <CredentialReissueContainer
          user={{ ...user, status: "suspended" }}
          operationId="22222222-2222-4222-8222-222222222222"
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("La cuenta permanece suspendida")).toBeTruthy();
    expect(screen.getByText(/no reactiva la cuenta/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restablecer acceso" })).toBeTruthy();
  });
});
