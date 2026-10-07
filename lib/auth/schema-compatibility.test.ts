import { describe, expect, it } from "vitest";
import { getSchema } from "better-auth/db";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function prismaModelFields(source: string, modelName: string): Set<string> {
  const block = source.match(
    new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1];
  if (!block) return new Set();

  return new Set(
    block
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
      .map((line) => line.split(/\s+/, 1)[0]),
  );
}

describe("Better Auth Prisma schema compatibility", () => {
  it("contains every model and field required by the configured auth instance", async () => {
    process.env.BETTER_AUTH_SECRET ??=
      "unit-test-only-better-auth-secret-with-more-than-32-characters";
    process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
    process.env.DATABASE_URL ??=
      "postgresql://unused:unused@localhost:5432/schema_compatibility_test";

    const { auth } = await import("./auth");
    const context = await auth.$context;
    const authSchema = getSchema(context.options);
    const prismaSchema = readFileSync(
      join(process.cwd(), "prisma", "schema.prisma"),
      "utf8",
    );
    const expectedModels = {
      user: "User",
      session: "Session",
      account: "Account",
      verification: "Verification",
      rateLimit: "RateLimit",
      twoFactor: "TwoFactor",
    } as const;

    expect(Object.keys(authSchema).sort()).toEqual(
      Object.keys(expectedModels).sort(),
    );

    for (const authModel of Object.keys(expectedModels) as Array<
      keyof typeof expectedModels
    >) {
      const prismaModelName = expectedModels[authModel];
      const prismaFields = prismaModelFields(prismaSchema, prismaModelName);
      expect(prismaFields.size, `${prismaModelName} must exist in Prisma`).toBeGreaterThan(0);
      const requiredFields = Object.keys(authSchema[authModel].fields);
      const missingFields = requiredFields.filter(
        (field) => !prismaFields.has(field),
      );

      expect(
        missingFields,
        `${prismaModelName} is missing Better Auth fields`,
      ).toEqual([]);
    }
  });
});
