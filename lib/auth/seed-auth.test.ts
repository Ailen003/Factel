import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  join(process.cwd(), "scripts", "seed-auth.mjs"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("authentication seed administrative profile", () => {
  it("declares one explicit owner fixture and profile-null trial fixtures", () => {
    expect(seed).toContain('role: "platform_admin",\n    adminProfile: "owner"');
    expect(seed).toContain('role: "trial_user",\n    adminProfile: null');
  });

  it("refuses ownership replacement and records the safe profile transition", () => {
    expect(seed).toContain('where: { adminProfile: "owner", id: { not: user.id } }');
    expect(seed).toContain("Refusing to create or replace the platform owner");
    expect(seed).toContain("Refusing to replace the existing platform owner");
    expect(seed).toContain('kind: "bootstrap_owner"');
    expect(seed).toContain('action: "admin.profile.bootstrap"');
    expect(seed).toContain("transaction.session.deleteMany");
  });
});
