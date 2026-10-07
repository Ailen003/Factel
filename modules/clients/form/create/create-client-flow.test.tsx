import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { ClientCreationPreview } from "../../lib/types/client.types";
import CreateClientFormContainer from "./create-client-form-container";
import CreateClientTrigger from "./create-client-trigger";

vi.mock("@/modules/requests/lib/actions/service-request.actions", () => ({ getClientServiceRequestsAction: vi.fn() }));

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), confirm: vi.fn(), getClient: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("../../lib/actions/client.actions", () => ({
  prepareClientCreationAction: mocks.prepare,
  confirmClientCreationAction: mocks.confirm,
  getClientByIdAction: mocks.getClient,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));

const draft = { name: "Ana Perez", email: "ana@example.com", phone: "+5351234567", company: "Demo", address: null, notes: null };
const preview: ClientCreationPreview = {
  planId: "plan-one", planHash: "a".repeat(64), expiresAt: "2099-01-01T00:00:00Z", client: draft, duplicates: [],
};
const receipt = { clientId: "created-client", operationId: "operation-one", replayed: false };
const candidate = { id: "existing-client", name: "Existing Ana", email: draft.email, phone: null, company: null, version: 1 };

function renderForm() {
  const callbacks = { onClose: vi.fn(), onSuccess: vi.fn(), onReuse: vi.fn(), onLockChange: vi.fn() };
  render(<NextIntlClientProvider locale="en" messages={messages} timeZone="UTC"><CreateClientFormContainer {...callbacks} /></NextIntlClientProvider>);
  return callbacks;
}

async function review() {
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: " Ana Perez " } });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "ANA@EXAMPLE.COM" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Phone" }), { target: { value: "+53 5123 4567" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Company" }), { target: { value: " Demo " } });
  fireEvent.click(screen.getByRole("button", { name: "Review client" }));
  await screen.findByRole("region", { name: messages.clientForm.previewTitle });
}

describe("confirmed client creation", () => {
  beforeEach(() => {
    mocks.prepare.mockReset().mockResolvedValue({ success: true, data: { ...preview, expiresAt: new Date(Date.now() + 60_000).toISOString() } });
    mocks.confirm.mockReset().mockResolvedValue({ success: true, data: receipt });
    mocks.getClient.mockReset().mockResolvedValue({ success: true, data: { ...draft, id: candidate.id, version: 1 } });
  });

  it("validates the RHF form before preparing and confirms exactly the server preview", async () => {
    const callbacks = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    await screen.findByText(messages.clientForm.validation.nameRequired);
    expect(mocks.prepare).not.toHaveBeenCalled();
    await review();
    expect(mocks.prepare).toHaveBeenCalledWith({ ...draft, address: undefined, notes: undefined });
    expect(screen.getByText("ana@example.com")).toBeTruthy();
    expect(screen.getByText("+5351234567")).toBeTruthy();
    expect(screen.queryByText("ANA@EXAMPLE.COM")).toBeNull();
    expect(mocks.confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: messages.clientForm.confirm }));
    await waitFor(() => expect(callbacks.onSuccess).toHaveBeenCalledWith(receipt));
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith({ planId: preview.planId, planHash: preview.planHash, acknowledgeDuplicates: false });
  });

  it("requires an explicit duplicate acknowledgment and preserves values when going back", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: { ...preview, expiresAt: new Date(Date.now() + 60_000).toISOString(), duplicates: [candidate] } });
    renderForm();
    await review();
    const confirm = screen.getByRole("button", { name: messages.clientForm.confirm });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(mocks.confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: messages.clientForm.back }));
    expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe(" Ana Perez ");
    fireEvent.click(screen.getByRole("button", { name: "Review client" }));
    await screen.findByRole("region", { name: messages.clientForm.previewTitle });
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(mocks.prepare).toHaveBeenCalledTimes(2);
  });

  it("reuses a duplicate by opening details without confirmation or a creation receipt", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: { ...preview, expiresAt: new Date(Date.now() + 60_000).toISOString(), duplicates: [candidate] } });
    render(<NextIntlClientProvider locale="en" messages={messages} timeZone="UTC"><CreateClientTrigger /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    await review();
    fireEvent.click(screen.getByRole("button", { name: "Use existing: Existing Ana" }));
    await screen.findByRole("dialog", { name: "Client details" });
    await waitFor(() => expect(mocks.getClient).toHaveBeenCalledWith(candidate.id));
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("locks pending/uncertain confirmation and retries the identical plan and duplicate choice", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: { ...preview, expiresAt: new Date(Date.now() + 60_000).toISOString(), duplicates: [candidate] } });
    let resolve!: (response: unknown) => void;
    mocks.confirm.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<NextIntlClientProvider locale="en" messages={messages} timeZone="UTC"><CreateClientTrigger /></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    await review();
    fireEvent.click(screen.getByRole("checkbox"));
    const confirm = screen.getByRole("button", { name: messages.clientForm.confirm });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("button", { name: messages.clientForm.back }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve({ success: false, error: { code: "CONFIRMATION_UNCERTAIN", message: "private error" } }));
    expect((screen.getByRole("button", { name: "Use existing: Existing Ana" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("private error")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: messages.clientForm.retryConfirmation }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    expect(mocks.confirm.mock.calls[1]).toEqual(mocks.confirm.mock.calls[0]);
    expect(mocks.confirm.mock.calls[1][0].acknowledgeDuplicates).toBe(true);
  });

  it("allows correcting the form after a known stale plan rejection", async () => {
    mocks.confirm.mockResolvedValue({ success: false, error: { code: "PLAN_STALE", message: "private error" } });
    const callbacks = renderForm();
    await review();
    fireEvent.click(screen.getByRole("button", { name: messages.clientForm.confirm }));
    await screen.findByText(messages.clients.errors.PLAN_STALE);
    expect(callbacks.onLockChange).toHaveBeenLastCalledWith(false);
    expect((screen.getByRole("button", { name: messages.clientForm.confirm }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: messages.clientForm.back }));
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
  });
});
