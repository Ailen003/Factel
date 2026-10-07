import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ServiceRequest } from "@/modules/requests/lib/types/service-request.types";
import DashboardMetricsPresentational from "./dashboard-metrics-presentational";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/modules/requests/lib/actions/service-request.actions", () => ({
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

function renderDashboard(recentRequests: ServiceRequest[] = [request]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DashboardMetricsPresentational
        response={{
          success: true,
          data: {
            totalClients: 17,
            totalRequests: 9,
            requestSummary: {
              total: 9,
              pending: 2,
              in_progress: 3,
              resolved: 4,
              cancelled: 0,
            },
            recentRequests,
          },
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe("dashboard metrics presentation", () => {
  beforeEach(() => refresh.mockClear());

  it("shows real totals, status distribution, navigation, and recent request actions", () => {
    renderDashboard();

    expect(screen.getByText("17")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText(messages.operationalDashboard.metrics.inProgress)).toBeTruthy();
    expect(screen.getAllByRole("button", {
      name: messages.requests.actionsFor.replace("{title}", request.title),
    })).toHaveLength(2);
    expect(screen.getByRole("link", { name: messages.operationalDashboard.navigation.clients })
      .getAttribute("href")).toBe("/clients");
    expect(screen.getAllByRole("link", { name: messages.operationalDashboard.navigation.allRequests })[0]
      .getAttribute("href")).toBe("/requests");
  });

  it("shows a focused empty state when no requests have been created", () => {
    renderDashboard([]);

    expect(screen.getByText(messages.operationalDashboard.noRecentRequests)).toBeTruthy();
    expect(screen.queryByText(request.title)).toBeNull();
  });

  it("localizes an unlisted load error and lets the user retry", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DashboardMetricsPresentational
          response={{
            success: false,
            error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" },
          }}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(messages.operationalDashboard.errors.INTERNAL_ERROR)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: messages.operationalDashboard.retry }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
