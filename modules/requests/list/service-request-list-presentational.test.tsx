import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ServiceRequest } from "../lib/types/service-request.types";
import ServiceRequestListPresentational from "./service-request-list-presentational";
import ServiceRequestListCardsView from "./service-request-list-cards-view";
import ServiceRequestListTableView from "./service-request-list-table-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../lib/actions/service-request.actions", () => ({
  getServiceRequestByIdAction: vi.fn(),
  editServiceRequestAction: vi.fn(),
  changeServiceRequestStatusAction: vi.fn(),
  deleteServiceRequestAction: vi.fn(),
}));

const request: ServiceRequest = {
  id: "request-a",
  client: { id: "client-a", name: "Ana" },
  title: "Router repair",
  description: "Replace the damaged router.",
  serviceType: "repair",
  priority: "high",
  status: "pending",
  preferredSchedule: null,
  serviceAddress: null,
  nextSteps: null,
  version: 2,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

describe("service request list management", () => {
  it("exposes the same action trigger in desktop and mobile presentations", () => {
    render(<NextIntlClientProvider locale="en" messages={messages}>
      <ServiceRequestListPresentational response={{ success: true, data: {
        requests: [request], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      } }} />
    </NextIntlClientProvider>);

    expect(screen.getAllByRole("button", { name: messages.requests.actionsFor.replace("{title}", request.title) })).toHaveLength(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps management actions available in both embedded presentations", () => {
    const actions = {
      onView: vi.fn(),
      onEdit: vi.fn(),
      onChangeStatus: vi.fn(),
      onDelete: vi.fn(),
    };
    render(<NextIntlClientProvider locale="en" messages={messages}>
      <ServiceRequestListTableView requests={[request]} embedded {...actions} />
      <ServiceRequestListCardsView requests={[request]} embedded {...actions} />
    </NextIntlClientProvider>);

    expect(screen.getAllByRole("button", { name: messages.requests.actionsFor.replace("{title}", request.title) })).toHaveLength(2);
  });
});
