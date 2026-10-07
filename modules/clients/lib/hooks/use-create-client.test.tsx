import { act, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { useCreateClient } from "./use-create-client";

const actions = vi.hoisted(() => ({ prepare: vi.fn(), confirm: vi.fn() }));
vi.mock("../actions/client.actions", () => ({ prepareClientCreationAction: actions.prepare, confirmClientCreationAction: actions.confirm }));

function wrapper({ children }: PropsWithChildren) {
  return <NextIntlClientProvider locale="en" messages={messages}>{children}</NextIntlClientProvider>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const values = { name: "Ana", email: "ana@example.com" };
const preview = {
  planId: "preview-plan", planHash: "a".repeat(64), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  client: { ...values, phone: null, company: null, address: null, notes: null }, duplicates: [],
};

describe("client creation lifecycle", () => {
  beforeEach(() => {
    actions.prepare.mockReset().mockResolvedValue({ success: true, data: preview });
    actions.confirm.mockReset().mockResolvedValue({ success: true, data: { clientId: "client", operationId: "operation", replayed: true } });
  });

  it("ignores an older prepare after reset and a newer draft", async () => {
    const older = deferred<unknown>();
    actions.prepare.mockImplementationOnce(() => older.promise);
    const { result } = renderHook(() => useCreateClient(), { wrapper });
    let first!: Promise<void>;
    act(() => { first = result.current.prepare(values); });
    act(() => result.current.reset());
    await act(async () => { await result.current.prepare({ ...values, name: "New draft" }); });
    await act(async () => {
      older.resolve({ success: true, data: { ...preview, planId: "obsolete-plan" } });
      await first;
    });
    expect(result.current.preview?.planId).toBe("preview-plan");
    expect(result.current.isLoading).toBe(false);
  });

  it("locks transport uncertainty against reset or prepare, then retries the same operation", async () => {
    actions.confirm.mockRejectedValueOnce(new Error("transport failure"));
    const onLockChange = vi.fn();
    const { result } = renderHook(() => useCreateClient({ onLockChange }), { wrapper });
    await act(async () => { await result.current.prepare(values); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.uncertain).toBe(true);
    expect(onLockChange).toHaveBeenLastCalledWith(true);
    act(() => result.current.reset());
    await act(async () => { await result.current.prepare({ ...values, name: "Another" }); });
    expect(result.current.preview?.planId).toBe(preview.planId);
    expect(actions.prepare).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.confirm(); });
    expect(actions.confirm.mock.calls[1]).toEqual(actions.confirm.mock.calls[0]);
    expect(result.current.result?.replayed).toBe(true);
    expect(onLockChange).toHaveBeenLastCalledWith(false);
  });

  it("does not call success or update the modal lock after confirmation resolves on an unmounted form", async () => {
    const pending = deferred<unknown>();
    actions.confirm.mockImplementation(() => pending.promise);
    const onSuccess = vi.fn();
    const onLockChange = vi.fn();
    const { result, unmount } = renderHook(() => useCreateClient({ onSuccess, onLockChange }), { wrapper });
    await act(async () => { await result.current.prepare(values); });
    let confirm!: Promise<void>;
    act(() => { confirm = result.current.confirm(); });
    unmount();
    await act(async () => {
      pending.resolve({ success: true, data: { clientId: "client", operationId: "operation", replayed: false } });
      await confirm;
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onLockChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("keeps the original uncertain operation locked if replay cannot authenticate", async () => {
    actions.confirm.mockRejectedValueOnce(new Error("lost response"));
    actions.confirm.mockResolvedValueOnce({ success: false, error: { code: "UNAUTHENTICATED", message: "session expired" } });
    const onLockChange = vi.fn();
    const { result } = renderHook(() => useCreateClient({ onLockChange }), { wrapper });
    await act(async () => { await result.current.prepare(values); });
    await act(async () => { await result.current.confirm(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.uncertain).toBe(true);
    expect(result.current.error).toBe(messages.clients.errors.CONFIRMATION_REAUTHENTICATE);
    expect(onLockChange).toHaveBeenLastCalledWith(true);
    act(() => result.current.reset());
    expect(result.current.preview?.planId).toBe(preview.planId);
    await act(async () => { await result.current.confirm(); });
    expect(actions.confirm.mock.calls[2]).toEqual(actions.confirm.mock.calls[0]);
    expect(result.current.result?.replayed).toBe(true);
  });
});
