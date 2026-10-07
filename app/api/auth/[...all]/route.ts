import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { isAllowedDuringTemporaryPasswordChange } from "@/lib/auth/route-access";
import { writeAuthAudit } from "@/lib/auth/audit";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);
const serverOnlyTwoFactorOperations = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
  "/two-factor/send-otp",
  "/two-factor/verify-otp",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/totp/generate",
]);

function authOperation(request: Request): string | null {
  const pathname = new URL(request.url).pathname;
  let operation = pathname.slice(pathname.indexOf("/api/auth") + "/api/auth".length) || "/";
  try {
    for (let attempt = 0; attempt < 3 && operation.includes("%"); attempt += 1) {
      operation = decodeURIComponent(operation);
    }
  } catch {
    return null;
  }
  if (operation.includes("%")) return null;
  return operation === "/" ? operation : operation.replace(/\/+$/, "");
}

function denied(code: string, message: string): Response {
  return Response.json({ code, message }, { status: 403 });
}

async function enforceAuthBoundary(
  request: Request,
  next: (request: Request) => Promise<Response>,
): Promise<Response> {
  const operation = authOperation(request);
  if (operation === null) {
    return denied("INVALID_AUTH_OPERATION", "Invalid authentication operation");
  }
  if (operation === "/admin" || operation.startsWith("/admin/")) {
    await writeAuthAudit({
      action: "auth.mfa.bypass_attempted",
      outcome: "DENIED",
      safeMetadata: { boundary: "better-auth-admin" },
    });
    return denied(
      "ADMIN_AUTH_OPERATION_NOT_PUBLIC",
      "This administrative authentication operation is server-only",
    );
  }
  if (serverOnlyTwoFactorOperations.has(operation)) {
    await writeAuthAudit({
      action: operation === "/two-factor/disable"
        ? "auth.mfa.disable_attempted"
        : "auth.mfa.bypass_attempted",
      outcome: "DENIED",
      safeMetadata: { boundary: "better-auth-two-factor" },
    });
    return denied(
      "TWO_FACTOR_OPERATION_NOT_PUBLIC",
      "Use the application two-factor flow",
    );
  }
  const session = await getCurrentSession(request.headers);
  if (session?.user.temporaryPasswordChangeRequired) {
    const allowed = isAllowedDuringTemporaryPasswordChange(
      request.method,
      operation,
    );
    if (!allowed) {
      return Response.json(
        {
          code: "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
          message: "Complete the required password replacement first",
        },
        { status: 403 },
      );
    }
  }
  if (
    session?.user.role === "platform_admin" &&
    (!session.user.twoFactorEnabled || !session.user.twoFactorVerified) &&
    !(
      (request.method === "GET" && operation === "/get-session") ||
      (request.method === "POST" && operation === "/sign-out")
    )
  ) {
    return denied(
      "ADMIN_MFA_ENROLLMENT_REQUIRED",
      "Complete administrator two-factor enrollment first",
    );
  }
  return next(request);
}

export const GET = (request: Request) =>
  enforceAuthBoundary(request, handlers.GET);
export const POST = (request: Request) =>
  enforceAuthBoundary(request, handlers.POST);
