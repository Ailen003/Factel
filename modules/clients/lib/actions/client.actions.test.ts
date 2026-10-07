import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), confirm: vi.fn(), list: vi.fn(), details: vi.fn(), edit: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/records/record-plan.services", () => ({ prepareClientCreation: mocks.prepare, confirmClientCreation: mocks.confirm }));
vi.mock("../services/client.services", () => ({ getAllClients: mocks.list, getClientById: mocks.details, editClient: mocks.edit, deleteClient: mocks.remove }));

describe("client action validation boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizes form values and delegates to the shared preparation service", async () => {
    mocks.prepare.mockResolvedValue({ success: true, data: { planId: "plan-a" } });
    const { prepareClientCreationAction } = await import("./client.actions");
    expect(await prepareClientCreationAction({ name: " Ana ", email: " ANA@EXAMPLE.COM " })).toMatchObject({ success: true });
    expect(mocks.prepare).toHaveBeenCalledWith({ name: "Ana", email: "ana@example.com" });
  });

  it("rejects injected scope, missing contact and mutable confirmation payloads before delegation", async () => {
    const { prepareClientCreationAction, confirmClientCreationAction } = await import("./client.actions");
    for (const dto of [{ name: "Ana" }, { name: "Ana", email: "ana@example.com", workspaceId: "workspace-b" }]) {
      expect(await prepareClientCreationAction(dto)).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    }
    expect(await confirmClientCreationAction({ planId: "plan-a", planHash: "a".repeat(64), acknowledgeDuplicates: false, client: { name: "Changed" } })).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
  });

  it("delegates only the approved plan identity and explicit duplicate acknowledgment", async () => {
    const { confirmClientCreationAction } = await import("./client.actions");
    const input = { planId: "plan-a", planHash: "a".repeat(64), acknowledgeDuplicates: true };
    mocks.confirm.mockResolvedValue({ success: true, data: { clientId: "client-a", operationId: "receipt-a", replayed: false } });
    expect(await confirmClientCreationAction(input)).toMatchObject({ success: true });
    expect(mocks.confirm).toHaveBeenCalledWith(input);
  });
});
