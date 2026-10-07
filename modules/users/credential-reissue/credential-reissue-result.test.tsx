import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ReissuedTemporaryCredentialResult } from "../lib/types/temporary-credential-reissue.types";
import { CredentialReissueResult } from "./credential-reissue-result";

const result: ReissuedTemporaryCredentialResult = {
  userId: "trial-1",
  suspended: false,
  temporaryPassword: "one-time-server-secret",
  revokedSessions: 2,
  issuance: {
    id: "issuance-1",
    version: 8,
    purpose: "recovery",
    reason: "forgotten_password",
    status: "issued",
    preparedAt: "2026-09-10T12:00:00.000Z",
    issuedAt: "2026-09-10T12:00:01.000Z",
    expiresAt: "2026-09-13T12:00:01.000Z",
    deliveredAt: null,
    deliveryChannel: null,
  },
};

describe("credential reissue result", () => {
  it("shows the secret once and confirms only a general delivery category", async () => {
    const confirmDelivery = vi.fn().mockResolvedValue(undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <CredentialReissueResult
          email="trial@example.com"
          result={result}
          loading={false}
          error={null}
          onConfirmDelivery={confirmDelivery}
          onDone={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("one-time-server-secret")).toBeTruthy();
    expect(screen.getByText("Issued · delivery unconfirmed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Credential delivered" }));

    await waitFor(() => expect(confirmDelivery).toHaveBeenCalledWith({
      issuanceId: "issuance-1",
      expectedVersion: 8,
      channel: "secure_message",
      confirmed: true,
    }));
    expect(JSON.stringify(confirmDelivery.mock.calls)).not.toContain("one-time-server-secret");
  });

  it("renders safe delivered metadata without channel details", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <CredentialReissueResult
          email="trial@example.com"
          result={{
            ...result,
            issuance: {
              ...result.issuance,
              deliveredAt: "2026-09-10T12:05:00.000Z",
              deliveryChannel: "phone",
            },
          }}
          loading={false}
          error={null}
          onConfirmDelivery={vi.fn()}
          onDone={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(screen.getByText(/Phone category/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Credential delivered" })).toBeNull();
  });

  it("may close without falsely confirming delivery", () => {
    const confirmDelivery = vi.fn();
    const onDone = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <CredentialReissueResult
          email="trial@example.com"
          result={result}
          loading={false}
          error={null}
          onConfirmDelivery={confirmDelivery}
          onDone={onDone}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close without confirming delivery" }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(confirmDelivery).not.toHaveBeenCalled();
  });
});
