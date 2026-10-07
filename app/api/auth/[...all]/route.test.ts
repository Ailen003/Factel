import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  writeAuthAudit: vi.fn(),
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({ GET: mocks.get, POST: mocks.post }),
}));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));
vi.mock("@/lib/auth/audit", () => ({ writeAuthAudit: mocks.writeAuthAudit }));

import { GET, POST } from "./route";

const pendingSession = {
  session: { id: "session-1" },
  user: { temporaryPasswordChangeRequired: true },
};

describe("Better Auth HTTP temporary-password boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(new Response(null, { status: 204 }));
    mocks.post.mockResolvedValue(new Response(null, { status: 204 }));
    mocks.writeAuthAudit.mockResolvedValue(undefined);
  });

  it.each([
    ["GET", "/api/auth/get-session"],
    ["POST", "/api/auth/change-password"],
    ["POST", "/api/auth/revoke-sessions"],
  ] as const)("blocks %s %s for a pending credential", async (method, path) => {
    mocks.getCurrentSession.mockResolvedValue(pendingSession);
    const request = new Request(`http://localhost${path}`, { method });

    const response = method === "GET" ? await GET(request) : await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "TEMPORARY_PASSWORD_CHANGE_REQUIRED",
    });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("allows only sign-out through the public Better Auth handler", async () => {
    mocks.getCurrentSession.mockResolvedValue(pendingSession);
    const request = new Request("http://localhost/api/auth/sign-out", { method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mocks.post).toHaveBeenCalledWith(request);
  });

  it("delegates normally after temporary-password replacement", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      ...pendingSession,
      user: { temporaryPasswordChangeRequired: false },
    });
    const request = new Request("http://localhost/api/auth/get-session");

    const response = await GET(request);

    expect(response.status).toBe(204);
    expect(mocks.get).toHaveBeenCalledWith(request);
  });

  it.each([
    "/api/auth/admin/set-user-password",
    "/api/auth/admin/revoke-user-sessions",
    "/api/auth/admin/revoke-user-sessions/",
    "/api/auth/%61dmin/revoke-user-sessions",
  ])("denies the server-only Better Auth operation %s before delegation", async (path) => {
    mocks.getCurrentSession.mockResolvedValue({
      ...pendingSession,
      user: { temporaryPasswordChangeRequired: false, role: "platform_admin" },
    });
    const request = new Request(`http://localhost${path}`, { method: "POST" });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "ADMIN_AUTH_OPERATION_NOT_PUBLIC",
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    "/api/auth/two-factor/enable",
    "/api/auth/two-factor/disable",
    "/api/auth/two-factor/verify-totp",
    "/api/auth/two-factor/verify-backup-code",
    "/api/auth/two-factor/generate-backup-codes",
    "/api/auth/totp/generate",
    "/api/auth/two-factor/disable/",
    "/api/auth/two-factor/%64isable",
    "/api/auth/two-factor%2Fdisable",
  ])("denies direct access to %s", async (path) => {
    const request = new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trustDevice: true, disableSession: true }),
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "TWO_FACTOR_OPERATION_NOT_PUBLIC",
    });
    expect(mocks.getCurrentSession).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("limits an administrator pending MFA to session state and sign-out", async () => {
    mocks.getCurrentSession.mockResolvedValue({
      session: { id: "session-1" },
      user: {
        role: "platform_admin",
        temporaryPasswordChangeRequired: false,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    const blocked = await POST(new Request("http://localhost/api/auth/change-password", {
      method: "POST",
    }));
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({
      code: "ADMIN_MFA_ENROLLMENT_REQUIRED",
    });

    const allowed = await GET(new Request("http://localhost/api/auth/get-session"));
    expect(allowed.status).toBe(204);
  });
});
