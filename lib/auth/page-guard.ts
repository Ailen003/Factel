import "server-only";

import { redirect } from "next/navigation";
import type { AdminCapability } from "./admin-capabilities";
import { requireAdminCapability } from "./admin-authorization";
import type { AppRole, AuthenticatedSession } from "./types";
import { AuthError } from "./types";
import { requireRoles } from "./session";
import { localizePath } from "./route-access";

async function redirectForAuthError(
  locale: string,
  returnTo: string,
  operation: () => Promise<AuthenticatedSession>,
): Promise<AuthenticatedSession> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof AuthError &&
      (error.code === "TEMPORARY_PASSWORD_CHANGE_REQUIRED" ||
        error.code === "TEMPORARY_PASSWORD_EXPIRED")
    ) {
      redirect(localizePath(locale, "/auth/change-password"));
    }
    if (error instanceof AuthError && error.code === "ADMIN_MFA_ENROLLMENT_REQUIRED") {
      const setup = localizePath(locale, "/auth/two-factor/setup");
      redirect(
        `${setup}?returnTo=${encodeURIComponent(localizePath(locale, returnTo))}`,
      );
    }
    if (
      error instanceof AuthError &&
      (error.code === "FORBIDDEN" ||
        error.code === "ADMIN_PROFILE_REQUIRED" ||
        error.code === "ADMIN_PROFILE_INCONSISTENT")
    ) {
      redirect(localizePath(locale, "/error-403"));
    }
    const login = localizePath(locale, "/auth/login");
    redirect(`${login}?returnTo=${encodeURIComponent(localizePath(locale, returnTo))}`);
  }
}

export function requirePageRoles(
  locale: string,
  roles: readonly AppRole[],
  returnTo: string,
): Promise<AuthenticatedSession> {
  return redirectForAuthError(locale, returnTo, () => requireRoles(roles));
}

export function requirePageAdminCapability(
  locale: string,
  capability: AdminCapability,
  returnTo: string,
): Promise<AuthenticatedSession> {
  return redirectForAuthError(locale, returnTo, () =>
    requireAdminCapability(capability),
  );
}
