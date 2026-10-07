import "server-only";

import type { Prisma } from "@/lib/persistence/generated/client";

/** Called after revoking conversation write authority, also by workspace content deletion. */
export async function deleteConversationProposals(tx: Prisma.TransactionClient, workspaceId: string, conversationId: string): Promise<void> {
  const revisions = { workspaceId, conversationId };
  await tx.conversation.updateMany({ where: { id: conversationId, workspaceId }, data: { currentProposalRevisionId: null } });
  await tx.recordPlan.updateMany({ where: { workspaceId, sourceConversationId: conversationId },
    data: { sourceRevisionId: null, normalizedPayload: {}, duplicateCandidates: [], payloadPurgedAt: new Date(), status: "INVALIDATED", invalidatedAt: new Date() } });
  await tx.operationReceipt.updateMany({ where: { workspaceId, sourceConversationId: conversationId }, data: { sourceRevisionId: null, sourceDeleted: true } });
  await tx.proposalFieldEvidence.deleteMany({ where: { workspaceId, proposalField: { revision: revisions } } });
  await tx.proposalFinding.deleteMany({ where: { workspaceId, revision: revisions } });
  await tx.proposalField.deleteMany({ where: { workspaceId, revision: revisions } });
  await tx.proposalRequestItem.deleteMany({ where: { workspaceId, revision: revisions } });
  await tx.proposalClientDraft.deleteMany({ where: { workspaceId, revision: revisions } });
  await tx.proposalRevision.deleteMany({ where: revisions });
}
