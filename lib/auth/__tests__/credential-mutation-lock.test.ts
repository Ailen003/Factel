import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  Client: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({
  Client: class MockClient {
    connect = mocks.connect;
    query = mocks.query;
    end = mocks.end;

    constructor(config: unknown) {
      mocks.Client(config);
    }
  },
}));

import { tryAcquireCredentialMutationLock } from "../credential-mutation-lock";

const originalDatabaseUrl = process.env.DATABASE_URL;

describe("credential mutation session lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://local/test";
    mocks.connect.mockResolvedValue(undefined);
    mocks.end.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("holds a dedicated PostgreSQL session until explicit release", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

    const lock = await tryAcquireCredentialMutationLock("trial-1");

    expect(lock).not.toBeNull();
    expect(mocks.end).not.toHaveBeenCalled();
    await lock!.release();
    await lock!.release();
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("pg_try_advisory_lock"),
      ["trial-1"],
    );
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pg_advisory_unlock"),
      ["trial-1"],
    );
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });

  it("returns a conflict without retaining a session when the target is locked", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

    await expect(
      tryAcquireCredentialMutationLock("trial-1"),
    ).resolves.toBeNull();
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });

  it("closes the dedicated session if lock acquisition fails", async () => {
    mocks.query.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      tryAcquireCredentialMutationLock("trial-1"),
    ).rejects.toThrow("database unavailable");
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });
});
