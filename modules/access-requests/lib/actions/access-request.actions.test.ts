import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ prepareAccessRequest: vi.fn() }));

vi.mock("@/modules/access-requests/lib/services/access-request.services", () => ({
  prepareAccessRequest: mocks.prepareAccessRequest,
}));

describe("access request action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates and normalizes input before preparing contact", async () => {
    mocks.prepareAccessRequest.mockResolvedValue({
      success: true,
      data: { contactEmail: "demo@example.com" },
    });
    const { prepareAccessRequestAction } = await import("./access-request.actions");

    await prepareAccessRequestAction({
      fullName: "  Alex Rivera ",
      email: " ALEX@EXAMPLE.COM ",
      organization: " Example Co ",
      message: " We want to evaluate the bilingual workflow. ",
    });

    expect(mocks.prepareAccessRequest).toHaveBeenCalledWith({
      fullName: "Alex Rivera",
      email: "alex@example.com",
      organization: "Example Co",
      message: "We want to evaluate the bilingual workflow.",
    });
  });

  it("rejects invalid public input before the service", async () => {
    const { prepareAccessRequestAction } = await import("./access-request.actions");
    const result = await prepareAccessRequestAction({
      fullName: "A",
      email: "invalid",
      organization: "",
      message: "short",
    });

    expect(result).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.prepareAccessRequest).not.toHaveBeenCalled();
  });
});
