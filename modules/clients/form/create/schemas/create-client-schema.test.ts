import { describe, expect, it } from "vitest";
import { createClientSchema, normalizeInternationalPhone } from "./create-client-schema";
import { convertCreateClientDto } from "../../../lib/types/client.types";

describe("manual client validation", () => {
  it("accepts one contact and normalizes without provider-specific email rewriting", () => {
    const result = createClientSchema.parse({ name: " A ", email: " A.Test+Demo@EXAMPLE.com ", company: " " });
    expect(convertCreateClientDto(result)).toMatchObject({ name: "A", email: "a.test+demo@example.com", company: undefined });
    expect(normalizeInternationalPhone(" +53 (5) 123-4567 ")).toBe("+5351234567");
    expect(createClientSchema.safeParse({ name: "A", phone: "+53 (5) 123-4567" }).success).toBe(true);
  });
  it.each([
    { name: " ", email: "a@example.com" }, { name: "A" },
    { name: "A", phone: "51234567" }, { name: "A", email: "bad", phone: "+5351234567" },
    { name: "A", email: "a@example.com", phone: "bad" },
    { name: "A", email: "a@example.com", workspaceId: "other" },
  ])("rejects incomplete, invalid or scope-injecting input %j", (input) => {
    expect(createClientSchema.safeParse(input).success).toBe(false);
  });
});
