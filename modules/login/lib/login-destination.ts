import { APP_ROLES, type AppRole } from "@/lib/auth/types";
import { getSafeReturnTo, localizePath } from "@/lib/auth/route-access";

export interface LoginResultData {
  twoFactorRedirect?: boolean;
  user?: {
    role?: unknown;
    temporaryPasswordChangeRequired?: unknown;
    twoFactorEnabled?: unknown;
  };
}

export function getLoginDestination({
  data,
  locale,
  returnTo,
}: {
  data: LoginResultData | null | undefined;
  locale: string;
  returnTo: string | null | undefined;
}): string {
  if (data?.user?.temporaryPasswordChangeRequired === true) {
    return localizePath(locale, "/auth/change-password");
  }

  if (data?.twoFactorRedirect === true) {
    const safeReturnTo = getSafeReturnTo(returnTo, "platform_admin");
    const search = new URLSearchParams({ returnTo: safeReturnTo });
    return `${localizePath(locale, "/auth/two-factor")}?${search.toString()}`;
  }

  const roleValue = data?.user?.role;
  const role: AppRole = APP_ROLES.includes(roleValue as AppRole)
    ? (roleValue as AppRole)
    : "trial_user";
  if (role === "platform_admin" && data?.user?.twoFactorEnabled !== true) {
    const safeReturnTo = getSafeReturnTo(returnTo, role);
    const search = new URLSearchParams({ returnTo: safeReturnTo });
    return `${localizePath(locale, "/auth/two-factor/setup")}?${search.toString()}`;
  }
  return localizePath(locale, getSafeReturnTo(returnTo, role));
}
