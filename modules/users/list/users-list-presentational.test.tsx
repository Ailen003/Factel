import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { User } from "../lib/types/user.types";
import UsersListPresentational from "./users-list-presentational";

const testState = vi.hoisted(() => ({
  refresh: vi.fn(),
  viewOpenChange: vi.fn(),
  executeProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: testState.refresh }),
}));

vi.mock("./hooks", () => ({
  useEditUserListAction: () => ({
    isModalOpen: false,
    editingItemId: null,
    handleViewItem: vi.fn(),
    handleEditItem: vi.fn(),
    handleModalOpenChange: vi.fn(),
    handleCloseModal: vi.fn(),
  }),
  useViewUserListAction: () => ({
    isModalOpen: false,
    viewingItemId: null,
    handleViewItem: vi.fn(),
    handleEditItem: vi.fn(),
    handleModalOpenChange: testState.viewOpenChange,
  }),
}));

vi.mock("../lib/hooks/use-user-admin-action", () => ({
  useUserAdminAction: () => ({
    execute: vi.fn(),
    isLoading: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock("../lib/hooks/use-admin-profile-mutation", () => ({
  useAdminProfileMutation: () => ({
    execute: testState.executeProfile,
    isLoading: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock("./users-list-table-view", () => ({
  default: ({ users, onAdminProfileAction, onCredentialReissue, onCredentialDeliveryConfirm, onMfaRecovery, onOwnershipTransfer }: {
    users: User[];
    onAdminProfileAction: (user: User, action: "promoteOperator" | "demoteOperator") => void;
    onCredentialReissue: (user: User) => void;
    onCredentialDeliveryConfirm: (user: User) => void;
    onMfaRecovery: (user: User) => void;
    onOwnershipTransfer: (user: User) => void;
  }) => (
    <>
      <button type="button" onClick={() => onAdminProfileAction(users[0], "promoteOperator")}>
        Open promotion confirmation
      </button>
      <button type="button" onClick={() => onAdminProfileAction(users[0], "demoteOperator")}>
        Open demotion confirmation
      </button>
      <button type="button" onClick={() => onCredentialReissue(users[0])}>
        Open credential flow
      </button>
      <button type="button" onClick={() => onCredentialDeliveryConfirm(users[0])}>
        Open delivery flow
      </button>
      <button type="button" onClick={() => onMfaRecovery(users[0])}>
        Open MFA recovery
      </button>
      <button type="button" onClick={() => onOwnershipTransfer(users[0])}>
        Open ownership transfer
      </button>
    </>
  ),
}));

vi.mock("./users-list-cards-view", () => ({
  default: ({ users, onAdminProfileAction }: {
    users: User[];
    onAdminProfileAction: (user: User, action: "promoteOperator") => void;
  }) => (
    <button type="button" onClick={() => onAdminProfileAction(users[0], "promoteOperator")}>
      Open card promotion confirmation
    </button>
  ),
}));
vi.mock("../form/edit/edit-user-container", () => ({ default: () => null }));
vi.mock("../details/user-details-container", () => ({ default: () => null }));
vi.mock("../credential-reissue/credential-reissue-container", () => ({
  CredentialReissueContainer: ({ operationId, user, onClose }: {
    operationId: string;
    user: User;
    onClose: () => void;
  }) => (
    <div data-testid="credential-flow" data-operation-id={operationId}>
      <span>{user.temporaryCredentialVersion}</span>
      <span>one-time-secret</span>
      <button type="button" onClick={onClose}>Finish credential flow</button>
    </div>
  ),
}));
vi.mock("../credential-reissue/credential-delivery-confirmation", () => ({
  CredentialDeliveryConfirmation: ({ user, onClose }: {
    user: User;
    onClose: () => void;
  }) => (
    <div data-testid="delivery-flow">
      <span>{user.latestTemporaryCredentialIssuance?.id}</span>
      <button type="button" onClick={onClose}>Finish delivery flow</button>
    </div>
  ),
}));
vi.mock("../ownership-transfer/ownership-transfer-panel-container", () => ({
  OwnershipTransferPanelContainer: () => <div data-testid="transfer-panel" />,
}));
vi.mock("../mfa-recovery/operator-mfa-recovery-container", () => ({
  OperatorMfaRecoveryContainer: ({ operationId, user, onClose }: {
    operationId: string;
    user: User;
    onClose: () => void;
  }) => (
    <div data-testid="mfa-recovery-flow" data-operation-id={operationId}>
      <span>{user.fullName}</span>
      <button type="button" onClick={onClose}>Finish MFA recovery</button>
    </div>
  ),
}));
vi.mock("../ownership-transfer/ownership-transfer-initiate-container", () => ({
  OwnershipTransferInitiateContainer: ({ operationId, target, onClose }: {
    operationId: string;
    target: User;
    onClose: () => void;
  }) => (
    <div data-testid="ownership-transfer-flow" data-operation-id={operationId}>
      <span>{target.fullName}</span>
      <button type="button" onClick={onClose}>Finish ownership transfer</button>
    </div>
  ),
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
  temporaryPasswordExpiresAt: "2026-09-13T00:00:00.000Z",
  temporaryPasswordPurpose: "activation",
  temporaryCredentialVersion: 4,
  latestTemporaryCredentialIssuance: null,
  trialActivatedAt: null,
  trialExpiresAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

describe("users list credential modal", () => {
  beforeEach(() => {
    testState.refresh.mockClear();
    testState.viewOpenChange.mockClear();
    testState.executeProfile.mockClear();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates one operation ID per intentional open and erases the secret on close", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[user]} currentUserId="admin-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open credential flow" }));
    expect(await screen.findByRole("dialog", { name: /Reissue activation credential/ })).toBeTruthy();
    expect(screen.getByTestId("credential-flow").getAttribute("data-operation-id"))
      .toBe("11111111-1111-4111-8111-111111111111");
    expect(screen.getByRole("button", { name: "Close credential dialog" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Finish credential flow" }));
    expect(screen.queryByText("one-time-secret")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open credential flow" }));
    expect((await screen.findByTestId("credential-flow")).getAttribute("data-operation-id"))
      .toBe("22222222-2222-4222-8222-222222222222");
  });

  it("requires accessible confirmation before promoting a trial user", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[user]} currentUserId="admin-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open promotion confirmation" }));
    expect(await screen.findByRole("alertdialog", { name: "Promote Trial User to operator?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Promote to operator" }));
    fireEvent.click(screen.getByRole("button", { name: "Promote to operator" }));
    expect(testState.executeProfile).toHaveBeenNthCalledWith(
      1,
      "promoteOperator",
      user,
      "11111111-1111-4111-8111-111111111111",
    );
    expect(testState.executeProfile).toHaveBeenNthCalledWith(
      2,
      "promoteOperator",
      user,
      "11111111-1111-4111-8111-111111111111",
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Open promotion confirmation" }));
    fireEvent.click(screen.getByRole("button", { name: "Promote to operator" }));
    expect(testState.executeProfile).toHaveBeenNthCalledWith(
      3,
      "promoteOperator",
      user,
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("uses the same promotion confirmation from the responsive card action", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[user]} currentUserId="admin-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open card promotion confirmation" }));
    expect(await screen.findByRole("alertdialog", { name: "Promote Trial User to operator?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Promote to operator" }));
    expect(testState.executeProfile).toHaveBeenCalledWith(
      "promoteOperator",
      user,
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("requires accessible confirmation before removing an operator", async () => {
    const operator = {
      ...user,
      role: "platform_admin" as const,
      adminProfile: "operator" as const,
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[operator]} currentUserId="admin-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open demotion confirmation" }));
    expect(await screen.findByRole("alertdialog", { name: "Remove operator access from Trial User?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove operator" }));
    expect(testState.executeProfile).toHaveBeenCalledWith(
      "demoteOperator",
      operator,
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("opens deferred delivery for the current issuance without creating a new operation", async () => {
    const pendingDeliveryUser: User = {
      ...user,
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
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[pendingDeliveryUser]} currentUserId="admin-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open delivery flow" }));
    expect(await screen.findByRole("dialog", { name: /Confirm credential delivery/ })).toBeTruthy();
    expect(screen.getByTestId("delivery-flow").textContent).toContain("issuance-current");
    expect(screen.queryByText("one-time-secret")).toBeNull();
  });

  it("mounts each administrative security flow with a fresh operation ID", async () => {
    const operator: User = {
      ...user,
      id: "operator-2",
      fullName: "Operations Admin",
      role: "platform_admin",
      adminProfile: "operator",
      twoFactorEnabled: true,
      twoFactorVerified: true,
    };
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <UsersListPresentational users={[operator]} currentUserId="owner-1" canManageAdmins canManageTrialUsers />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open MFA recovery" }));
    expect((await screen.findByTestId("mfa-recovery-flow")).getAttribute("data-operation-id"))
      .toBe("11111111-1111-4111-8111-111111111111");
    fireEvent.click(screen.getByRole("button", { name: "Finish MFA recovery" }));

    fireEvent.click(screen.getByRole("button", { name: "Open ownership transfer" }));
    expect((await screen.findByTestId("ownership-transfer-flow")).getAttribute("data-operation-id"))
      .toBe("22222222-2222-4222-8222-222222222222");
  });
});
