import "server-only";

import { writeAuthAudit } from "./audit";
import {
  adminProfileConsistencyError,
  hasAdminCapability,
  type AdminCapability,
} from "./admin-capabilities";
import { requireActiveSession } from "./session";
import { AuthError, type AuthenticatedSession } from "./types";

export async function requireAdminCapability(
  capability: AdminCapability,
  requestHeaders?: Headers,
): Promise<AuthenticatedSession> {
  const session = await requireActiveSession(requestHeaders);
  const consistencyError = adminProfileConsistencyError(session.user);
  if (!consistencyError && hasAdminCapability(session.user, capability)) return session;

  const reason = consistencyError ?? "FORBIDDEN";
  await writeAuthAudit({
    action: "admin.authorization",
    actorUserId: session.user.id,
    outcome: "DENIED",
    safeMetadata: { capability, reason },
  });
  throw new AuthError(reason);
}
