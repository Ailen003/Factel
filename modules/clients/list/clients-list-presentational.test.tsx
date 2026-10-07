import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ClientsListPresentational from "./clients-list-presentational";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }), useSearchParams: () => new URLSearchParams() }));
vi.mock("../lib/actions/client.actions", () => ({ getClientByIdAction: vi.fn() }));
vi.mock("@/modules/requests/lib/actions/service-request.actions", () => ({ getClientServiceRequestsAction: vi.fn() }));

describe("client list states", () => {
  it("shows a safe translated failure and retries server rendering without echoing private errors", () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><ClientsListPresentational response={{ success: false, error: { code: "DB_FAILURE", message: "private database contents" } }} /></NextIntlClientProvider>);
    expect(screen.getByRole("alert").textContent).toContain(messages.clients.errors.INTERNAL_ERROR);
    expect(screen.queryByText("private database contents")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: messages.clients.retry }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("provides empty results in both responsive views", () => {
    render(<NextIntlClientProvider locale="en" messages={messages}><ClientsListPresentational response={{ success: true, data: { clients: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } } }} /></NextIntlClientProvider>);
    expect(screen.getAllByText(messages.clients.empty)).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
