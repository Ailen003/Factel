import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updatePlatformContactEmail: vi.fn(),
  pauseAccessRequests: vi.fn(),
  resumeAccessRequests: vi.fn(),
}));

vi.mock("@/modules/platform-settings/lib/services/platform-settings.services", () => ({
  getPlatformSettings: vi.fn(),
  updatePlatformContactEmail: mocks.updatePlatformContactEmail,
  pauseAccessRequests: mocks.pauseAccessRequests,
  resumeAccessRequests: mocks.resumeAccessRequests,
}));

import {
  pauseAccessRequestsAction,
  resumeAccessRequestsAction,
  updatePlatformContactEmailAction,
} from "./platform-settings.actions";

describe("platform settings actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes contact email and preserves the expected version", async () => {
    mocks.updatePlatformContactEmail.mockResolvedValue({ success: true, data: {} });

    await updatePlatformContactEmailAction({
      accessContactEmail: " DEMO@EXAMPLE.COM ",
      expectedVersion: 3,
    });

    expect(mocks.updatePlatformContactEmail).toHaveBeenCalledWith({
      accessContactEmail: "demo@example.com",
      expectedVersion: 3,
    });
  });

  it("validates pause and resume independently", async () => {
    mocks.pauseAccessRequests.mockResolvedValue({ success: true, data: {} });
    mocks.resumeAccessRequests.mockResolvedValue({ success: true, data: {} });

    await pauseAccessRequestsAction({ expectedVersion: 1 });
    await resumeAccessRequestsAction({ expectedVersion: 2 });
    const invalid = await pauseAccessRequestsAction({ expectedVersion: -1 });

    expect(mocks.pauseAccessRequests).toHaveBeenCalledWith({ expectedVersion: 1 });
    expect(mocks.resumeAccessRequests).toHaveBeenCalledWith({ expectedVersion: 2 });
    expect(invalid).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("does not call services for invalid contact input", async () => {
    const result = await updatePlatformContactEmailAction({
      accessContactEmail: "invalid",
      expectedVersion: 0,
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.updatePlatformContactEmail).not.toHaveBeenCalled();
  });
});
