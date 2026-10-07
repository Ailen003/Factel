import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ConversationCreationContainer from "./conversation-creation-container";
import type { ConversationCreationState } from "../lib/types/conversation-creation.types";

const mocks = vi.hoisted(() => ({ load: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), abandon: vi.fn() }));
vi.mock("../lib/actions/conversation-creation.actions", () => ({ getConversationCreationStateAction: mocks.load,
  prepareConversationCreationAction: mocks.prepare, confirmConversationCreationAction: mocks.confirm, abandonConversationCreationAction: mocks.abandon }));
vi.mock("@/modules/clients/details/client-details-container", () => ({ default: ({ clientId }: { clientId: string }) => <p>Client detail {clientId}</p> }));
vi.mock("@/modules/requests/details/service-request-details-container", () => ({ default: ({ requestId }: { requestId: string }) => <p>Request detail {requestId}</p> }));
const client = { name: "Saved caller", email: "saved@example.com", phone: "+12025550123", company: "Company", address: "Saved street", notes: "Saved notes" };
const duplicate = { id: "client-a", version: 4, ...client };
const ready: ConversationCreationState = { conversationId: "conversation-a", revisionId: "revision-a", version: 5, status: "ready", duplicates: [duplicate], preview: null, result: null };
function pending(choice: "new" | "existing"): ConversationCreationState {
  return { ...ready, version: 6, status: "record_plan_pending", preview: { conversationId: ready.conversationId, revisionId: ready.revisionId!, version: 6,
    planId: "plan-a", planHash: "a".repeat(64), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), client, duplicates: [duplicate],
    choice: choice === "new" ? { kind: "new" } : { kind: "existing", clientId: duplicate.id },
    requests: [1, 2].map((number) => ({ stableItemId: `item-${number}`, title: `Service ${number}`, description: `Description ${number}`,
      serviceType: "other", priority: "normal", serviceAddress: `Address ${number}`, preferredSchedule: `Schedule ${number}`, nextSteps: `Next ${number}`, status: "pending" })),
  } };
}
function mount(status = "ready", locale: "en" | "es" = "en") {
  return render(<NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es} timeZone="UTC">
    <ConversationCreationContainer conversationId={ready.conversationId} status={status} eligible onStateChange={vi.fn()} onChanged={vi.fn()} onGuardChange={vi.fn()} />
  </NextIntlClientProvider>);
}
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("ConversationCreationContainer", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.load.mockResolvedValue({ success: true, data: ready }); });

  it("uses one client choice for the full preview and displays the saved details of a reused client", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: pending("existing") });
    mount(); fireEvent.click(button("Create client and requests"));
    fireEvent.click(await screen.findByRole("button", { name: "Use Saved caller" }));
    await screen.findByText("Saved client to reuse");
    expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ choice: { kind: "existing", clientId: "client-a" } }));
    expect(screen.getByText(en.conversationCreation.preserveClient)).toBeTruthy();
    expect(screen.getByText("Saved notes")).toBeTruthy(); expect(screen.getByText("Saved street")).toBeTruthy();
    for (const number of [1, 2]) {
      const request = screen.getByRole("region", { name: `Request ${number}` });
      expect(within(request).getByText(`Service ${number}`)).toBeTruthy();
      expect(within(request).getByText(`Next ${number}`)).toBeTruthy();
      expect(within(request).getByText(`Schedule ${number}`)).toBeTruthy();
      expect(within(request).getByText(en.requests.statuses.pending)).toBeTruthy();
      expect(within(request).queryByRole("button")).toBeNull();
    }
    expect(button("Create 2 requests").disabled).toBe(false);
  });

  it("requires acknowledgment before creating a distinct new client and all requests", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: pending("new") });
    mocks.confirm.mockResolvedValue({ success: false, error: { code: "PLAN_STALE" } });
    mount(); fireEvent.click(button("Create client and requests"));
    fireEvent.click(await screen.findByRole("button", { name: "Create a different client" }));
    await screen.findByText("Client to create");
    expect(button("Create client and 2 requests").disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: en.conversationCreation.acknowledgeDuplicates }));
    fireEvent.click(button("Create client and 2 requests"));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith({ planId: "plan-a", planHash: "a".repeat(64), acknowledgeDuplicates: true }));
    expect(await screen.findByRole("button", { name: "Reload current state" })).toBeTruthy();
  });

  it("offers reload and return paths when a pending plan cannot be recovered", async () => {
    mocks.load.mockResolvedValue({ success: true, data: { ...ready, status: "record_plan_pending", duplicates: [] } });
    mount("record_plan_pending");
    await screen.findByRole("region", { name: "Review final creation" });
    await waitFor(() => expect(button("Retry").disabled).toBe(false));
    expect(button("Back to editing").disabled).toBe(false);
    fireEvent.click(button("Retry"));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
  });

  it.each(["en", "es"] as const)("recovers the receipt in %s and mounts only the selected record detail", async (locale) => {
    const copy = locale === "en" ? en.conversationCreation : es.conversationCreation;
    mocks.load.mockResolvedValue({ success: true, data: { ...ready, status: "completed", result: {
      operationId: "operation-a", conversationId: ready.conversationId, clientId: "client-a", requestIds: ["request-a", "request-b"], completedAt: "2026-09-08T12:00:00Z", replayed: true,
    } } });
    mount("completed", locale);
    await screen.findByRole("region", { name: copy.receiptTitle });
    expect(screen.queryByText("Client detail client-a")).toBeNull();
    fireEvent.click(button(copy.viewClient)); expect(screen.getByText("Client detail client-a")).toBeTruthy();
    fireEvent.click(button(copy.viewRequest.replace("{number}", "2")));
    expect(screen.getByText("Request detail request-b")).toBeTruthy(); expect(screen.queryByText("Client detail client-a")).toBeNull();
    fireEvent.click(button(copy.viewRequest.replace("{number}", "2"))); expect(screen.queryByText("Request detail request-b")).toBeNull();
    expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("retains the receipt when the resulting client was subsequently deleted", async () => {
    mocks.load.mockResolvedValue({ success: true, data: { ...ready, status: "completed", result: {
      operationId: "operation-a", conversationId: ready.conversationId, clientId: null, requestIds: ["request-a"], completedAt: "2026-09-08T12:00:00Z", replayed: true,
    } } });
    mount("completed");
    await screen.findByText(en.conversationCreation.deletedClient);
    expect(screen.queryByRole("button", { name: en.conversationCreation.viewClient })).toBeNull();
    expect(screen.getByText("operation-a")).toBeTruthy(); expect(button("View request 1")).toBeTruthy();
  });
});
