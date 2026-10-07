import type { AppRole } from "./types";

export interface RoutePolicy {
  path: string;
  roles: readonly AppRole[] | null;
  guestOnly?: boolean;
}

export const routePolicies = [
  {
    path: "/dashboard",
    roles: ["trial_user", "platform_admin"],
  },
  {
    path: "/conversations",
    roles: ["trial_user", "platform_admin"],
  },
  {
    path: "/clients",
    roles: ["trial_user", "platform_admin"],
  },
  {
    path: "/requests",
    roles: ["trial_user", "platform_admin"],
  },
  {
    path: "/users",
    roles: ["platform_admin"],
  },
  {
    path: "/settings",
    roles: ["platform_admin"],
  },
  {
    path: "/auth/login",
    roles: null,
    guestOnly: true,
  },
  {
    path: "/auth/change-password",
    roles: null,
  },
  {
    path: "/auth/two-factor/setup",
    roles: null,
  },
  {
    path: "/auth/two-factor",
    roles: null,
  },
] as const satisfies readonly RoutePolicy[];

const LOCALES = new Set(["en", "es"]);

export function stripLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && LOCALES.has(segments[0])) segments.shift();
  return `/${segments.join("/")}` || "/";
}

export function getRoutePolicy(pathname: string): RoutePolicy | null {
  const normalized = stripLocale(pathname);
  return (
    routePolicies.find(
      ({ path }) => normalized === path || normalized.startsWith(`${path}/`),
    ) ?? null
  );
}

export function canAccessPath(pathname: string, role: AppRole): boolean {
  const policy = getRoutePolicy(pathname);
  return !policy || policy.roles === null || policy.roles.includes(role);
}

export function getSafeReturnTo(
  value: string | null | undefined,
  role: AppRole,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }

  try {
    const parsed = new URL(value, "https://internal.invalid");
    if (parsed.origin !== "https://internal.invalid") return "/dashboard";
    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const policy = getRoutePolicy(parsed.pathname);
    return policy?.roles?.includes(role) ? candidate : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function localizePath(locale: string, path: string): string {
  const safeLocale = LOCALES.has(locale) ? locale : "en";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutLocale = normalized.replace(/^\/(en|es)(?=\/|\?|#|$)/, "");
  return `/${safeLocale}${withoutLocale.startsWith("/") ? withoutLocale : `/${withoutLocale}`}`;
}

export function isAllowedDuringTemporaryPasswordChange(
  method: string,
  authOperation: string,
): boolean {
  return method === "POST" && authOperation === "/sign-out";
}
