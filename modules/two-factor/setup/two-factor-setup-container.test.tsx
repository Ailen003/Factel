import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  verify: vi.fn(),
  regenerate: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: { signOut: mocks.signOut },
}));
vi.mock("../lib/actions/two-factor.actions", () => ({
  beginTwoFactorEnrollmentAction: mocks.begin,
  verifyTwoFactorEnrollmentAction: mocks.verify,
  regenerateTwoFactorBackupCodesAction: mocks.regenerate,
}));

import { TwoFactorSetupContainer } from "./two-factor-setup-container";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.elementFromPoint = () => null;
});

function renderSetup(status: "enrollment-required" | "enabled" = "enrollment-required") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorSetupContainer initialStatus={status} returnTo="/dashboard" />
    </NextIntlClientProvider>,
  );
}

describe("two-factor setup container", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signOut.mockResolvedValue(undefined);
  });

  it("keeps backup codes hidden until the first official TOTP verification succeeds", async () => {
    mocks.begin.mockResolvedValue({
      success: true,
      data: {
        totpURI: "otpauth://totp/App:admin?secret=MANUALSECRET&issuer=App",
        manualSecret: "MANUALSECRET",
        backupCodes: ["backup-one", "backup-two"],
      },
    });
    mocks.verify.mockResolvedValue({ success: true, data: { revokedSessions: 2 } });
    renderSetup();

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));

    await screen.findByText("Connect your authenticator app");
    expect(screen.queryByText("backup-one")).toBeNull();
    expect(mocks.begin).toHaveBeenCalledWith({ password: "current-password" });

    const totp = screen.getByLabelText("Six-digit verification code");
    fireEvent.change(totp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and enable" }));

    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith({ code: "123456" }));
    expect(await screen.findByText("backup-one")).toBeTruthy();
    expect(screen.getByText("backup-two")).toBeTruthy();
  });

  it("requires password and explicit confirmation before regeneration", async () => {
    renderSetup("enabled");

    fireEvent.click(screen.getByRole("button", { name: "Replace backup codes" }));
    expect(await screen.findByText("Enter your current password.")).toBeTruthy();
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });
});
