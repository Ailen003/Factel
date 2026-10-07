import { describe, expect, expectTypeOf, it } from "vitest";
import {
  convertCreateUserDto,
  convertEditUserDto,
  parseUserFilters,
} from "./user.types";
import type { User } from "./user.types";

describe("user filter DTO", () => {
  it("coerces pagination and allowlisted ordering", () => {
    expect(parseUserFilters({ page: "2", limit: "20", sortBy: "fullName", sortOrder: "asc" })).toMatchObject({ page: 2, limit: 20, sortBy: "fullName", sortOrder: "asc" });
  });

  it("falls back safely for altered pagination and sort fields", () => {
    expect(parseUserFilters({ page: "-5", limit: "1000", sortBy: "password", sortOrder: "sideways" })).toMatchObject({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
  });

  it("never forwards an altered role or password during account creation", () => {
    const input = { name: "Alex Rivera", email: "alex@example.com", locale: "es" as const, initialCreditAllocation: 12, role: "platform_admin", password: "attacker-chosen" };
    expect(convertCreateUserDto(input)).not.toHaveProperty("role");
    expect(convertCreateUserDto(input)).not.toHaveProperty("password");
    expect(convertCreateUserDto(input)).toMatchObject({ locale: "es", initialCreditAllocation: 12 });
  });

  it("never forwards role changes through the generic edit converter", () => {
    const input = {
      name: " Operator Name ",
      role: "platform_admin",
      locale: "es" as const,
    };
    const result = convertEditUserDto(input);

    expect(result).toEqual({ name: "Operator Name", locale: "es" });
    expect(result).not.toHaveProperty("role");
  });

  it("exposes only boolean MFA readiness in the user DTO", () => {
    const user = {} as User;
    expectTypeOf(user.twoFactorEnabled).toEqualTypeOf<boolean>();
    expectTypeOf(user.twoFactorVerified).toEqualTypeOf<boolean>();
  });
});
