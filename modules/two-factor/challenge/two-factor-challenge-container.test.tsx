import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";

const mocks = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
  verifyBackup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("returnTo=%2Fusers"),
}));
vi.mock("@/lib/auth/auth-client", () => ({ authClient: { signOut: mocks.signOut } }));
vi.mock("../lib/actions/two-factor.actions", () => ({
  verifyTwoFactorTotpChallengeAction: mocks.verifyTotp,
  verifyTwoFactorBackupChallengeAction: mocks.verifyBackup,
}));

import { TwoFactorChallengeContainer } from "./two-factor-challenge-container";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.elementFromPoint = () => null;
});

describe("two-factor challenge container", () => {
  beforeEach(() => vi.clearAllMocks());

  it("supports keyboard-accessible factor switching without exposing trusted-device controls", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorChallengeContainer />
      </NextIntlClientProvider>,
    );

    expect(screen.getByLabelText("Six-digit authenticator code").getAttribute("autocomplete"))
      .toBe("one-time-code");
    expect(screen.queryByText(/remember this device/i)).toBeNull();
    expect(screen.queryByText(/trusted device/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Use a backup code instead" }));
    expect(screen.getByLabelText("Backup code").getAttribute("autocomplete"))
      .toBe("one-time-code");
  });

  it("shows field errors and prevents submission for incomplete TOTP input", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TwoFactorChallengeContainer />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Six-digit authenticator code"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(await screen.findByText("Enter the complete six-digit code.")).toBeTruthy();
    expect(mocks.verifyTotp).not.toHaveBeenCalled();
  });
});
