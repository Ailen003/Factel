import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { UserDetails } from "../lib/types/user.types";
import { UserDetailsPresentational } from "./user-details-presentational";

const user: UserDetails = {
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
  temporaryPasswordExpiresAt: "2026-09-13T12:00:00.000Z",
  temporaryPasswordPurpose: "activation",
  temporaryCredentialVersion: 1,
  latestTemporaryCredentialIssuance: {
    id: "issuance-1",
    version: 1,
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

describe("user credential details", () => {
  it("shows safe issuance metadata and the purpose-sensitive action", () => {
    const onCredentialReissue = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <UserDetailsPresentational
          user={user}
          canManageTrialUsers
          onCredentialReissue={onCredentialReissue}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Issued · delivery unconfirmed")).toBeTruthy();
    expect(screen.getByText("Credential expired")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reissue activation credential" }));
    expect(onCredentialReissue).toHaveBeenCalledWith(user);
    expect(document.body.textContent).not.toContain("password-value");
  });

  it("labels administrator profiles safely and explains operator read-only access", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <UserDetailsPresentational
          user={{ ...user, role: "platform_admin", adminProfile: "operator" }}
          canManageAdmins={false}
          canManageTrialUsers
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByText("Operator").length).toBeGreaterThan(0);
    expect(screen.getByText(/Only the owner can change or manage administrator accounts/i)).toBeTruthy();
  });

  it("uses an explicit label for an unconfigured administrator profile", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <UserDetailsPresentational
          user={{ ...user, role: "platform_admin", adminProfile: null }}
          canManageAdmins
          canManageTrialUsers
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByText("Unconfigured administrator").length).toBeGreaterThan(0);
  });

  it("allows confirming an issued-undelivered credential later without reissuing it", () => {
    const onCredentialDeliveryConfirm = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <UserDetailsPresentational
          user={user}
          canManageTrialUsers
          onCredentialDeliveryConfirm={onCredentialDeliveryConfirm}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Credential delivered" }));
    expect(onCredentialDeliveryConfirm).toHaveBeenCalledWith(user);
    expect(document.body.textContent).not.toContain("temporary-secret");
  });

  it("fails closed when capability props are omitted", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <UserDetailsPresentational
          user={user}
          onCredentialReissue={vi.fn()}
          onCredentialDeliveryConfirm={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.queryByRole("button", { name: "Reissue activation credential" }))
      .toBeNull();
    expect(screen.queryByRole("button", { name: "Credential delivered" }))
      .toBeNull();
  });
});
