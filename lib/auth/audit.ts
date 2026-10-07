import "server-only";

import type { Prisma } from "@/lib/persistence/generated/client";
import { prisma } from "@/lib/persistence/prisma";

type AuthAuditAction =
  | "admin.authorization"
  | "admin.profile.bootstrap"
  | "admin.profile.promote"
  | "admin.profile.demote"
  | "auth.login"
  | "auth.logout"
  | "auth.mfa.enrollment_begin"
  | "auth.mfa.enrollment_complete"
  | "auth.mfa.enrollment_rejected"
  | "auth.mfa.challenge_succeeded"
  | "auth.mfa.challenge_rejected"
  | "auth.mfa.challenge_locked"
  | "auth.mfa.backup_code_used"
  | "auth.mfa.backup_codes_regenerated"
  | "auth.mfa.disable_attempted"
  | "auth.mfa.bypass_attempted"
  | "auth.mfa.pending_denied"
  | "auth.mfa.operator_recovery_started"
  | "auth.mfa.operator_recovery_completed"
  | "auth.mfa.operator_recovery_denied"
  | "auth.mfa.owner_break_glass"
  | "ownership.transfer.initiated"
  | "ownership.transfer.cancelled"
  | "ownership.transfer.declined"
  | "ownership.transfer.expired"
  | "ownership.transfer.accepted"
  | "ownership.transfer.conflict"
  | "platform.admission.pause"
  | "platform.admission.resume"
  | "platform.settings.read"
  | "platform.settings.update"
  | "user.create"
  | "user.activate"
  | "user.password_recover"
  | "user.delete"
  | "user.role_change"
  | "user.sessions_revoke"
  | "user.status_change"
  | "user.temporary_credential.prepare"
  | "user.temporary_credential.issue"
  | "user.temporary_credential.deliver"
  | "user.temporary_credential.fail"
  | "user.update";

type AuthAuditWriter = Pick<Prisma.TransactionClient, "auditEvent">;

export async function writeAuthAudit(
  input: {
    action: AuthAuditAction;
    actorUserId?: string | null;
    targetUserId?: string | null;
    outcome: "ALLOWED" | "SUCCEEDED" | "FAILED" | "DENIED";
    correlationId?: string;
    declaredReason?: string | null;
    safeMetadata?: Record<string, string | number | boolean | null>;
  },
  database: AuthAuditWriter = prisma,
): Promise<void> {
  await database.auditEvent.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      targetUserId: input.targetUserId ?? null,
      resourceType: "identity",
      resourceId: input.targetUserId ?? input.actorUserId ?? null,
      outcome: input.outcome,
      declaredReason: input.declaredReason ?? null,
      correlationId: input.correlationId ?? crypto.randomUUID(),
      safeMetadata: input.safeMetadata,
    },
  });
}
