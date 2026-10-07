import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { OwnershipTransferView } from "../lib/types/admin-security.types";
import { OwnershipTransferPanelPresentational } from "./ownership-transfer-panel-presentational";

const pending: OwnershipTransferView = {
  id: "transfer-1",
  ownerUserId: "owner-1",
  ownerName: "Current Owner",
  targetUserId: "operator-2",
  targetName: "Proposed Owner",
  ownerVersion: 4,
  targetVersion: 9,
  status: "pending",
  initiatedAt: "2026-09-11T12:00:00.000Z",
  expiresAt: "2026-09-11T12:30:00.000Z",
  resolvedAt: null,
  canCancel: false,
  canAccept: true,
  canDecline: true,
};

function renderPanel(transfer: OwnershipTransferView, onResolve = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OwnershipTransferPanelPresentational transfer={transfer} loading={false} error={null} onResolve={onResolve} />
    </NextIntlClientProvider>,
  );
  return onResolve;
}

describe("ownership transfer panel", () => {
  it("shows only recipient actions supplied by authoritative flags", () => {
    const onResolve = renderPanel(pending);
    expect(screen.getByRole("heading", { name: "Ownership transfer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancel transfer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept ownership" }));
    fireEvent.click(screen.getByRole("button", { name: "Decline transfer" }));
    expect(onResolve).toHaveBeenNthCalledWith(1, "accept");
    expect(onResolve).toHaveBeenNthCalledWith(2, "decline");
  });

  it("shows explicit expired feedback without terminal actions", () => {
    renderPanel({ ...pending, status: "expired", canAccept: false, canDecline: false });
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.getByText(/passed its acceptance window/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
