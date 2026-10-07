import { describe, expect, it } from "vitest";
import { editServiceRequestSchema } from "./edit-service-request-schema";

const valid = {
  clientId: " client-a ",
  title: " Router repair ",
  description: " Replace the damaged router. ",
  serviceType: "repair" as const,
  priority: "high" as const,
  preferredSchedule: " Tomorrow ",
  serviceAddress: " Main Street ",
  nextSteps: " Call before arrival ",
};

describe("edit service request schema", () => {
  it("accepts and normalizes every editable field", () => {
    expect(editServiceRequestSchema.parse(valid)).toEqual({
      ...valid,
      clientId: "client-a",
      title: "Router repair",
      description: "Replace the damaged router.",
      preferredSchedule: "Tomorrow",
      serviceAddress: "Main Street",
      nextSteps: "Call before arrival",
    });
  });

  it.each(["workspaceId", "status", "id", "expectedVersion"])("rejects injected %s", (field) => {
    expect(editServiceRequestSchema.safeParse({ ...valid, [field]: "injected" }).success).toBe(false);
  });

  it("rejects missing required content and overlong optional fields", () => {
    expect(editServiceRequestSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(editServiceRequestSchema.safeParse({ ...valid, nextSteps: "x".repeat(4001) }).success).toBe(false);
  });
});
