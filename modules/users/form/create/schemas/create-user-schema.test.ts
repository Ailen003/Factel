import { describe, expect, it } from "vitest";
import { createUserSchema } from "./create-user-schema";

describe("create user schema", () => {
  it("accepts account metadata without a client-supplied credential", () => {
    expect(createUserSchema.safeParse({
      name: "Alex Rivera",
      email: "ALEX@example.com",
      locale: "en",
      initialCreditAllocation: 10,
    }).success).toBe(true);
  });

  it("strips client-supplied credential and role fields", () => {
    const parsed = createUserSchema.parse({
      name: "Alex Rivera",
      email: "alex@example.com",
      locale: "en",
      initialCreditAllocation: 10,
      password: "attacker-chosen-password",
      role: "platform_admin",
    });
    expect(parsed).not.toHaveProperty("password");
    expect(parsed).not.toHaveProperty("role");
  });

  it("rejects an unsupported locale and a negative allocation", () => {
    const base = { name: "Alex Rivera", email: "alex@example.com" };
    expect(createUserSchema.safeParse({ ...base, locale: "fr", initialCreditAllocation: 10 }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, locale: "en", initialCreditAllocation: -1 }).success).toBe(false);
  });
});
