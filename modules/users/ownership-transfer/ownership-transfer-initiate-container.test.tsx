import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { User } from "../lib/types/user.types";
import { OwnershipTransferInitiateContainer } from "./ownership-transfer-initiate-container";

const state = vi.hoisted(() => ({
  initiateTransfer: vi.fn(async () => undefined),
  reset: vi.fn(),
  isLoading: false,
}));

const owner: User = {
  id: "owner-1", email: "owner@example.com", fullName: "Current Owner",
  role: "platform_admin", adminProfile: "owner", adminProfileVersion: 4,
  twoFactorEnabled: true, twoFactorVerified: true, status: "active", locale: "en",
  initialCreditAllocation: 0, temporaryPasswordChangeRequired: false,
  temporaryPasswordExpiresAt: null, temporaryPasswordPurpose: null,
  temporaryCredentialVersion: 0, latestTemporaryCredentialIssuance: null,
  trialActivatedAt: null, trialExpiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-11T00:00:00.000Z",
};
const target: User = {
  ...owner,
  id: "operator-2",
  email: "operator@example.com",
  fullName: "Proposed Owner",
  adminProfile: "operator",
  adminProfileVersion: 9,
};

vi.mock("../lib/hooks/use-user", () => ({
  useUser: () => ({ user: owner, isLoading: false, error: null }),
}));
vi.mock("../lib/hooks/use-admin-security", () => ({
  useAdminSecurity: () => ({
    initiateTransfer: state.initiateTransfer,
    isLoading: state.isLoading,
    error: null,
    transferResult: null,
    reset: state.reset,
  }),
}));

describe("ownership transfer initiate container", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    state.initiateTransfer.mockClear();
    state.reset.mockClear();
    state.isLoading = false;
  });

  it("submits both optimistic versions and fresh step-up credentials", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OwnershipTransferInitiateContainer
          currentUserId="owner-1"
          target={target}
          operationId="22222222-2222-4222-8222-222222222222"
          onClose={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/does not change either administrator's role/i)).toBeTruthy();
    expect(screen.getByText(/within 30 minutes/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "owner-password" } });
    fireEvent.change(screen.getByLabelText("Current authenticator code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create transfer request" }));

    await waitFor(() => expect(state.initiateTransfer).toHaveBeenCalledWith({
      operationId: "22222222-2222-4222-8222-222222222222",
      targetUserId: "operator-2",
      expectedOwnerVersion: 4,
      expectedTargetVersion: 9,
      password: "owner-password",
      totpCode: "654321",
      confirmed: true,
    }));
  });
});
