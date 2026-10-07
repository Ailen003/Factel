import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistence/prisma", () => ({ prisma: {} }));

import { getWorkspaceCreditBalance, initializeWorkspaceCredits } from "./credit.services";

function creditTransaction(allocation: number, initializedAt: Date | null = null) {
  return {
    workspace: {
      findUnique: vi.fn().mockResolvedValue({
        creditInitializedAt: initializedAt,
        owner: { initialCreditAllocation: allocation },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: initializedAt ? 0 : 1 }),
    },
    creditEntry: {
      create: vi.fn().mockResolvedValue({ id: "entry-a" }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    creditReservation: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: null } }),
    },
  };
}

describe("workspace credits", () => {
  it("grants a positive initial allocation exactly once", async () => {
    const tx = creditTransaction(10);
    await expect(initializeWorkspaceCredits(tx as never, "workspace-a")).resolves.toBe(true);
    expect(tx.creditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ kind: "GRANT", quantity: 10, operationKey: "workspace-credit-initialization:workspace-a" }),
    });

    const replay = creditTransaction(10, new Date());
    await expect(initializeWorkspaceCredits(replay as never, "workspace-a")).resolves.toBe(false);
    expect(replay.creditEntry.create).not.toHaveBeenCalled();
  });

  it("records zero initialization with the marker and no invalid zero ledger row", async () => {
    const tx = creditTransaction(0);
    await expect(initializeWorkspaceCredits(tx as never, "workspace-zero")).resolves.toBe(true);
    expect(tx.workspace.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "workspace-zero", creditInitializedAt: null },
    }));
    expect(tx.creditEntry.create).not.toHaveBeenCalled();
  });

  it("derives available, reserved, and consumed balances from authoritative state", async () => {
    const tx = creditTransaction(0);
    tx.creditEntry.groupBy.mockResolvedValue([
      { kind: "GRANT", _sum: { quantity: 10 } },
      { kind: "CONSUME", _sum: { quantity: 1 } },
    ]);
    tx.creditReservation.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
    await expect(getWorkspaceCreditBalance(tx as never, "workspace-a")).resolves.toEqual({
      available: 7,
      reserved: 2,
      consumed: 1,
    });
  });
});
