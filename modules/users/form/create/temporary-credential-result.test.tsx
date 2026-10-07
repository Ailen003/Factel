import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { TemporaryCredentialResult } from "./temporary-credential-result";

const result = {
  temporaryPassword: "server-generated-temporary-password",
  temporaryPasswordExpiresAt: "2026-09-13T12:00:00.000Z",
  user: {
    id: "trial-1",
    email: "trial@example.com",
    fullName: "Trial User",
    role: "trial_user" as const,
    adminProfile: null,
      adminProfileVersion: 0,
      twoFactorEnabled: false,
      twoFactorVerified: false,
    status: "active" as const,
    locale: "en" as const,
    initialCreditAllocation: 10,
    temporaryPasswordChangeRequired: true,
    temporaryPasswordExpiresAt: "2026-09-13T12:00:00.000Z",
    temporaryPasswordPurpose: "activation" as const,
    temporaryCredentialVersion: 1,
    latestTemporaryCredentialIssuance: null,
    trialActivatedAt: null,
    trialExpiresAt: null,
    createdAt: "2026-09-10T12:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
  },
};

describe("one-time temporary credential result", () => {
  it("shows and copies the server-generated password without putting it in the form", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <TemporaryCredentialResult result={result} onDone={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(result.temporaryPassword)).toBeTruthy();
    expect(screen.getByText("trial@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy password" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(result.temporaryPassword));
    expect(screen.getByText(/password copied/i)).toBeTruthy();
  });

  it("keeps the password selectable and announces a clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard blocked")) },
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <TemporaryCredentialResult result={result} onDone={vi.fn()} />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy password" }));
    expect(await screen.findByText(/could not be copied automatically/i)).toBeTruthy();
    expect(screen.getByText(result.temporaryPassword).className).toContain("select-all");
  });
});
