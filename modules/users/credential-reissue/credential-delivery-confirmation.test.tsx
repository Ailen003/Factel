import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { User } from "../lib/types/user.types";
import { CredentialDeliveryConfirmation } from "./credential-delivery-confirmation";

const mocks = vi.hoisted(() => ({
  confirmDelivery: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
}));

vi.mock("../lib/hooks/use-temporary-credential-reissue", () => ({
  useTemporaryCredentialReissue: () => ({
    confirmDelivery: mocks.confirmDelivery,
    deliveryResult: null,
    isLoading: false,
    error: null,
    reset: mocks.reset,
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
  temporaryPasswordChangeRequired: true,
  temporaryPasswordExpiresAt: "2026-09-13T12:00:01.000Z",
  temporaryPasswordPurpose: "activation",
  temporaryCredentialVersion: 4,
  latestTemporaryCredentialIssuance: {
    id: "issuance-current",
    version: 4,
    purpose: "activation",
    reason: "expired_credential",
    status: "issued",
    preparedAt: "2026-09-10T12:00:00.000Z",
    issuedAt: "2026-09-10T12:00:01.000Z",
    expiresAt: "2026-09-13T12:00:01.000Z",
    deliveredAt: null,
    deliveryChannel: null,
  },
  trialActivatedAt: null,
  trialExpiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-10T12:00:01.000Z",
};

describe("deferred credential delivery confirmation", () => {
  it("confirms the existing issuance without displaying or reissuing a secret", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <CredentialDeliveryConfirmation user={user} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Issued · delivery unconfirmed")).toBeTruthy();
    expect(screen.queryByText(/temporary password/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Credential delivered" }));

    await waitFor(() => expect(mocks.confirmDelivery).toHaveBeenCalledWith({
      issuanceId: "issuance-current",
      expectedVersion: 4,
      channel: "secure_message",
      confirmed: true,
    }));
  });
});
