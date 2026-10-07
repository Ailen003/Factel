import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/messages/en.json";
import { UserActionsMenu } from "./user-actions-menu";
import type { User } from "../lib/types/user.types";

const trialUser: User = {
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
  temporaryCredentialVersion: 0,
  latestTemporaryCredentialIssuance: null,
  trialActivatedAt: "2026-09-07T00:00:00.000Z",
  trialExpiresAt: "2026-09-21T00:00:00.000Z",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

function renderMenu(user: User, canManageAdmins = true, currentUserId = "admin-1") {
  const onAdminAction = vi.fn();
  const onAdminProfileAction = vi.fn();
  const onCredentialReissue = vi.fn();
  const onCredentialDeliveryConfirm = vi.fn();
  const onMfaRecovery = vi.fn();
  const onOwnershipTransfer = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UserActionsMenu
        user={user}
        currentUserId={currentUserId}
        canManageAdmins={canManageAdmins}
        canManageTrialUsers
        onView={vi.fn()}
        onEdit={vi.fn()}
        onAdminAction={onAdminAction}
        onAdminProfileAction={onAdminProfileAction}
        onCredentialReissue={onCredentialReissue}
        onCredentialDeliveryConfirm={onCredentialDeliveryConfirm}
        onMfaRecovery={onMfaRecovery}
        onOwnershipTransfer={onOwnershipTransfer}
      />
    </NextIntlClientProvider>,
  );
  return { onAdminAction, onAdminProfileAction, onCredentialReissue, onCredentialDeliveryConfirm, onMfaRecovery, onOwnershipTransfer };
}

describe("user actions menu", () => {
  it("offers lifecycle, session, and deletion actions for another trial user", async () => {
    const { onAdminAction, onCredentialReissue } = renderMenu(trialUser);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("Suspend")).toBeTruthy();
    expect(screen.getByText("Revoke sessions")).toBeTruthy();
    fireEvent.click(screen.getByText("Reset access"));
    expect(onCredentialReissue).toHaveBeenCalledWith(trialUser);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByText("Delete account"));
    expect(onAdminAction).toHaveBeenCalledWith(trialUser, "delete");
  });

  it("does not expose lifecycle actions for the current administrator", async () => {
    renderMenu({ ...trialUser, id: "admin-1", role: "platform_admin", adminProfile: "owner" }, true, "admin-1");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("View details")).toBeTruthy();
    expect(screen.queryByText("Suspend")).toBeNull();
    expect(screen.queryByText("Revoke sessions")).toBeNull();
    expect(screen.queryByText("Delete account")).toBeNull();
    expect(screen.queryByText("Reset access")).toBeNull();
    expect(screen.queryByText("Remove operator")).toBeNull();
    expect(screen.queryByText("Promote to operator")).toBeNull();
    expect(screen.getByText(/platform owner cannot be removed/i)).toBeTruthy();
  });

  it("shows only view and an owner-only explanation for administrator targets to operators", async () => {
    renderMenu({
      ...trialUser,
      id: "operator-2",
      role: "platform_admin",
      adminProfile: "operator",
    }, false);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("View details")).toBeTruthy();
    expect(screen.getByText(/available only to the owner/i)).toBeTruthy();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Remove operator")).toBeNull();
    expect(screen.queryByText("Suspend")).toBeNull();
    expect(screen.queryByText("Revoke sessions")).toBeNull();
    expect(screen.queryByText("Delete account")).toBeNull();
  });

  it("offers owner-only promotion and operator removal without trial lifecycle controls on admins", async () => {
    const { onAdminProfileAction } = renderMenu(trialUser);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByText("Promote to operator"));
    expect(onAdminProfileAction).toHaveBeenCalledWith(trialUser, "promoteOperator");

    const operator = {
      ...trialUser,
      id: "operator-2",
      role: "platform_admin" as const,
      adminProfile: "operator" as const,
    };
    const second = renderMenu(operator);
    const menuButtons = screen.getAllByRole("button", { name: "Open user actions" });
    fireEvent.pointerDown(menuButtons[menuButtons.length - 1], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByText("Remove operator"));
    expect(second.onAdminProfileAction).toHaveBeenCalledWith(operator, "demoteOperator");
    expect(screen.queryByText("Suspend")).toBeNull();
    expect(screen.queryByText("Revoke sessions")).toBeNull();
    expect(screen.queryByText("Delete account")).toBeNull();
  });

  it("offers MFA recovery and ownership transfer only for another MFA-ready active operator", async () => {
    const operator: User = {
      ...trialUser,
      id: "operator-2",
      role: "platform_admin",
      adminProfile: "operator",
      twoFactorEnabled: true,
      twoFactorVerified: true,
    };
    const { onMfaRecovery, onOwnershipTransfer } = renderMenu(operator);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    fireEvent.click(await screen.findByText("Reset operator MFA"));
    expect(onMfaRecovery).toHaveBeenCalledWith(operator);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByText("Transfer ownership"));
    expect(onOwnershipTransfer).toHaveBeenCalledWith(operator);
  });

  it("keeps recovery but hides transfer for a suspended operator", async () => {
    renderMenu({
      ...trialUser,
      id: "operator-2",
      role: "platform_admin",
      adminProfile: "operator",
      status: "suspended",
      twoFactorEnabled: true,
      twoFactorVerified: true,
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("Reset operator MFA")).toBeTruthy();
    expect(screen.queryByText("Transfer ownership")).toBeNull();
  });

  it("hides both security actions for an operator without verified MFA", async () => {
    renderMenu({
      ...trialUser,
      id: "operator-2",
      role: "platform_admin",
      adminProfile: "operator",
      twoFactorEnabled: false,
      twoFactorVerified: false,
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("Remove operator")).toBeTruthy();
    expect(screen.queryByText("Reset operator MFA")).toBeNull();
    expect(screen.queryByText("Transfer ownership")).toBeNull();
  });

  it("uses activation wording for a never-activated trial account", async () => {
    const unactivated = { ...trialUser, trialActivatedAt: null, trialExpiresAt: null };
    const { onCredentialReissue } = renderMenu(unactivated);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    fireEvent.click(await screen.findByText("Reissue activation credential"));
    expect(onCredentialReissue).toHaveBeenCalledWith(unactivated);
  });

  it("keeps reset access available without reactivating a suspended trial user", async () => {
    const suspended = { ...trialUser, status: "suspended" as const };
    renderMenu(suspended);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByText("Reset access")).toBeTruthy();
    expect(screen.getByText("Activate")).toBeTruthy();
    expect(screen.getByText(/Only an active trial user can be promoted/i)).toBeTruthy();
    expect(screen.queryByText("Promote to operator")).toBeNull();
  });

  it("offers deferred delivery confirmation only for the current issued credential", async () => {
    const pendingDelivery = {
      ...trialUser,
      temporaryCredentialVersion: 2,
      latestTemporaryCredentialIssuance: {
        id: "issuance-2",
        version: 2,
        purpose: "recovery" as const,
        reason: "forgotten_password" as const,
        status: "issued" as const,
        preparedAt: "2026-09-10T12:00:00.000Z",
        issuedAt: "2026-09-10T12:00:01.000Z",
        expiresAt: "2026-09-13T12:00:01.000Z",
        deliveredAt: null,
        deliveryChannel: null,
      },
    };
    const { onCredentialDeliveryConfirm } = renderMenu(pendingDelivery);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Open user actions" }), {
      button: 0,
      ctrlKey: false,
    });

    fireEvent.click(await screen.findByText("Confirm credential delivery"));
    expect(onCredentialDeliveryConfirm).toHaveBeenCalledWith(pendingDelivery);
  });
});
