import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { emptyRequestDraft, requestFieldKeys, type ProposalRevisionView } from "../lib/types/proposal.types";
import ConversationReprocessingComparison from "./conversation-reprocessing-comparison";

const current: ProposalRevisionView = { id: "revision-a", revisionNumber: 2, parentRevisionId: null, authorKind: "human", authorName: "Reviewer",
  createdAt: "2026-09-08T00:00:00Z", readyAt: null, readyByName: null, canMarkReady: true, findings: [], fields: [],
  draft: { client: { name: "Saved name", email: "", phone: "5555555555", company: "", address: "", notes: "" },
    requests: [{ ...emptyRequestDraft("add"), title: "Saved request", description: "Human correction" }] } };
const candidate: ProposalRevisionView = { ...current, id: "candidate-b", authorKind: "extraction",
  fields: [{ target: "client", itemId: null, fieldKey: "name", observedValue: "New name", normalizedValue: "New name", provenance: "extracted", confidence: 0.9, evidenceIds: ["evidence-a"] }],
  draft: { client: { ...current.draft.client, name: "New name", phone: "1111111111" },
    requests: [{ ...emptyRequestDraft("item-b"), title: "New request", description: "AI description" }] } };

describe.each([{ locale: "en", messages: en }, { locale: "es", messages: es }])("reprocessing comparison ($locale)", ({ locale, messages }) => {
  const r = messages.conversationReview.reprocessing;
  const checkName = r.takeField.replace("{field}", messages.clients.fields.name);
  const mount = (resolve = vi.fn().mockResolvedValue(true), evidence = vi.fn(), guard = vi.fn()) => {
    render(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ConversationReprocessingComparison current={current} candidate={candidate} busy={false} onResolve={resolve} onEvidence={evidence} onDirtyChange={guard} />
    </NextIntlClientProvider>);
    return { resolve, evidence, guard };
  };
  const choose = async (name: string) => {
    fireEvent.keyDown(screen.getByRole("combobox", { name: r.requestChoice }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name }));
  };
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.releasePointerCapture = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows both values and evidence, adopts only selected fields, and guards unsaved selections", async () => {
    const { resolve, evidence, guard } = mount();
    expect(screen.getByText("Saved name")).toBeTruthy(); expect(screen.getByText("New name")).toBeTruthy();
    expect((screen.getByRole("button", { name: r.adopt }) as HTMLButtonElement).disabled).toBe(true);
    const source = r.fieldSource.replace("{field}", messages.clients.fields.name).replace("{source}", r.candidate);
    fireEvent.click(screen.getByRole("button", { name: messages.conversationReview.evidenceFor.replace("{field}", source) }));
    expect(evidence).toHaveBeenCalledWith(candidate.fields[0]);
    fireEvent.click(screen.getByRole("checkbox", { name: checkName }));
    expect(guard).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: r.adopt }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ keepPrevious: false, clientFields: ["name"], requests: [], removeRequestIds: [] }));
  });

  it("adds a request only after an explicit choice and requires confirmation to keep the previous revision", async () => {
    const { resolve } = mount();
    await choose(r.addRequest);
    fireEvent.click(screen.getByRole("button", { name: r.adopt }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ keepPrevious: false, clientFields: [], requests: [{ candidateItemId: "item-b", targetItemId: null, fields: [...requestFieldKeys] }], removeRequestIds: [] }));
    resolve.mockClear();
    fireEvent.click(screen.getByRole("button", { name: r.keepPrevious }));
    expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: r.keepPrevious }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ keepPrevious: true, clientFields: [], requests: [], removeRequestIds: [] }));
  });

  it("maps an existing request explicitly and keeps its unselected corrections", async () => {
    const { resolve } = mount();
    await choose(r.mapRequest.replace("{number}", "1").replace("{title}", "Saved request"));
    expect((screen.getByRole("button", { name: r.adopt }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("Human correction").length).toBeGreaterThan(0);
    const title = r.takeField.replace("{field}", messages.requests.fields.title);
    fireEvent.click(screen.getByRole("checkbox", { name: title }));
    fireEvent.click(screen.getByRole("button", { name: r.adopt }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith({ keepPrevious: false, clientFields: [], requests: [{ candidateItemId: "item-b", targetItemId: "add", fields: ["title"] }], removeRequestIds: [] }));
  });

  it("prevents removing every request until an explicitly added replacement exists", async () => {
    const { resolve } = mount();
    fireEvent.click(screen.getByRole("checkbox", { name: r.removeCurrent.replace("{number}", "1").replace("{title}", "Saved request") }));
    expect((screen.getByRole("button", { name: r.adopt }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(messages.conversationReview.invalidDraft);
    await choose(r.addRequest);
    fireEvent.click(screen.getByRole("button", { name: r.adopt }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ removeRequestIds: ["add"], requests: [{ candidateItemId: "item-b", targetItemId: null, fields: [...requestFieldKeys] }] })));
  });
});
