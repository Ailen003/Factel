import { describe, expect, it } from "vitest";
import { createAccessRequestSchema } from "./create-access-request-schema";

const validRequest = {
  fullName: "Alex Rivera",
  email: "alex@example.com",
  organization: "Example Company",
  message: "We want to evaluate a bilingual intake workflow.",
};

describe("access request schema", () => {
  it("normalizes a valid request", () => {
    expect(
      createAccessRequestSchema.parse({
        ...validRequest,
        fullName: "  Alex Rivera  ",
        email: "  ALEX@EXAMPLE.COM  ",
      }),
    ).toMatchObject({
      fullName: "Alex Rivera",
      email: "alex@example.com",
    });
  });

  it("rejects invalid contact data and an underspecified message", () => {
    expect(
      createAccessRequestSchema.safeParse({
        ...validRequest,
        email: "not-an-email",
        message: "Too short",
      }).success,
    ).toBe(false);
  });

  it("accepts an empty optional organization", () => {
    expect(
      createAccessRequestSchema.safeParse({
        ...validRequest,
        organization: "",
      }).success,
    ).toBe(true);
  });
});
