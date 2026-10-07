import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function configureAuthTestEnvironment() {
  process.env.BETTER_AUTH_SECRET ??=
    "unit-test-only-better-auth-secret-with-more-than-32-characters";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.DATABASE_URL ??=
    "postgresql://unused:unused@localhost:5432/two_factor_contract_test";
}

describe("Better Auth 1.7.3 administrator TOTP contract", () => {
  it("configures TOTP-only enrollment, a five-attempt lockout, and no trusted-device lifetime", async () => {
    configureAuthTestEnvironment();
    const { auth } = await import("./auth");
    const context = await auth.$context;
    const plugin = context.options.plugins?.find((candidate) => candidate.id === "two-factor");
    const options = plugin?.options as {
      issuer?: string;
      skipVerificationOnEnable?: boolean;
      allowPasswordless?: boolean;
      otpOptions?: unknown;
      twoFactorCookieMaxAge?: number;
      trustDeviceMaxAge?: number;
      totpOptions?: { digits?: number; period?: number };
      backupCodeOptions?: { storeBackupCodes?: string };
      accountLockout?: {
        enabled?: boolean;
        maxFailedAttempts?: number;
        durationSeconds?: number;
      };
    } | undefined;

    expect(options).toMatchObject({
      issuer: "Conversation Processing Demo",
      skipVerificationOnEnable: false,
      allowPasswordless: false,
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 0,
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { storeBackupCodes: "encrypted" },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 900,
      },
    });
    expect(options?.otpOptions).toBeUndefined();
  });

  it("keeps the prepared PostgreSQL migration additive and disabled for existing users", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma",
        "migrations",
        "20260910223000_admin_totp_mfa",
        "migration.sql",
      ),
      "utf8",
    );

    expect(sql).toContain(
      'ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(sql).toContain('CREATE TABLE "two_factor"');
    expect(sql).toContain('"verified" BOOLEAN NOT NULL DEFAULT true');
    expect(sql).toContain('"failed_verification_count" INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain('CREATE UNIQUE INDEX "two_factor_user_id_key"');
    expect(sql).toContain('ON DELETE CASCADE ON UPDATE CASCADE');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM|UPDATE "users"|INSERT INTO)\b/i);
  });
});
