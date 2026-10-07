import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ClientDetailsContainer from "./client-details-container";

const mocks = vi.hoisted(() => ({ client: vi.fn(), requests: vi.fn() }));
vi.mock("../lib/actions/client.actions", () => ({ getClientByIdAction: mocks.client }));
vi.mock("@/modules/requests/lib/actions/service-request.actions", () => ({ getClientServiceRequestsAction: mocks.requests }));

describe("client detail request tab", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.client.mockResolvedValue({ success: true, data: { id: "client-a", name: "Ana", email: "ana@example.com",
      phone: null, company: null, address: null, notes: null, version: 1,
      createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } });
    mocks.requests.mockResolvedValue({ success: true, data: { requests: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      summary: { total: 0, pending: 0, in_progress: 0, resolved: 0, cancelled: 0 } } });
  });

  it("loads associated requests only after the request tab is selected", async () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><ClientDetailsContainer clientId="client-a" /></NextIntlClientProvider>);
    expect(await screen.findByText("ana@example.com")).toBeTruthy();
    expect(mocks.requests).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: messages.clients.detailsTabs.requests }));
    await waitFor(() => expect(mocks.requests).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-a", page: 1, limit: 10 })));
    expect(await screen.findAllByText(messages.requests.empty)).toHaveLength(2);
  });
});
