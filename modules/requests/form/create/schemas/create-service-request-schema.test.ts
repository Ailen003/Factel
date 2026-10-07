import { describe, expect, it } from "vitest";
import { createServiceRequestSchema } from "./create-service-request-schema";

describe("create service request schema", () => {
  const valid = { clientId: "client-a", title: "Install router", description: "Install the new office router", serviceType: "installation" };

  it("accepts the business contract and defaults priority to normal", () => {
    const result = createServiceRequestSchema.parse(valid);
    expect(result.priority).toBe("normal");
  });

  it("rejects missing client, title, description and unknown catalogs", () => {
    for (const input of [
      { ...valid, clientId: "" }, { ...valid, title: "" }, { ...valid, description: "" },
      { ...valid, serviceType: "billing" }, { ...valid, priority: "urgent" },
    ]) expect(createServiceRequestSchema.safeParse(input).success).toBe(false);
  });

  it("rejects injected workspace and operational status", () => {
    expect(createServiceRequestSchema.safeParse({ ...valid, workspaceId: "other" }).success).toBe(false);
    expect(createServiceRequestSchema.safeParse({ ...valid, status: "resolved" }).success).toBe(false);
  });
});
