import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getRoutePolicy,
  getSafeReturnTo,
  localizePath,
  stripLocale,
} from "@/lib/auth/route-access";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const policy = getRoutePolicy(request.nextUrl.pathname);
  const localeSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  const locale = routing.locales.includes(localeSegment as "en" | "es")
    ? localeSegment
    : routing.defaultLocale;

  let session = null;
  try {
    session = await getCurrentSession(request.headers);
  } catch (error) {
    console.error("Session lookup failed in proxy", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const activeSession = session?.user.status === "active" ? session : null;
  const normalizedPath = stripLocale(request.nextUrl.pathname);
  if (
    activeSession?.user.temporaryPasswordChangeRequired &&
    normalizedPath !== "/auth/change-password" &&
    (Boolean(policy?.roles) || policy?.guestOnly === true)
  ) {
    const passwordUrl = request.nextUrl.clone();
    passwordUrl.pathname = localizePath(locale, "/auth/change-password");
    passwordUrl.search = "";
    return NextResponse.redirect(passwordUrl);
  }
  if (
    activeSession?.user.role === "platform_admin" &&
    (!activeSession.user.twoFactorEnabled || !activeSession.user.twoFactorVerified) &&
    normalizedPath !== "/auth/two-factor/setup" &&
    (Boolean(policy?.roles) || policy?.guestOnly === true)
  ) {
    const setupUrl = request.nextUrl.clone();
    setupUrl.pathname = localizePath(locale, "/auth/two-factor/setup");
    setupUrl.search = "";
    setupUrl.searchParams.set(
      "returnTo",
      policy?.roles
        ? `${request.nextUrl.pathname}${request.nextUrl.search}`
        : localizePath(locale, "/dashboard"),
    );
    return NextResponse.redirect(setupUrl);
  }
  if (policy?.roles && !activeSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localizePath(locale, "/auth/login");
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "returnTo",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (
    policy?.roles &&
    activeSession &&
    !(policy.roles as readonly string[]).includes(activeSession.user.role)
  ) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = localizePath(locale, "/error-403");
    forbiddenUrl.search = "";
    return NextResponse.redirect(forbiddenUrl);
  }

  if (policy?.guestOnly && activeSession) {
    const target = getSafeReturnTo(
      request.nextUrl.searchParams.get("returnTo"),
      activeSession.user.role,
    );
    return NextResponse.redirect(
      new URL(localizePath(locale, target), request.nextUrl.origin),
    );
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
