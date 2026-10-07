import "server-only";

import { start } from "workflow/api";
import { prisma } from "@/lib/persistence/prisma";
import { conversationTranscriptionWorkflow } from "./conversation-transcription.workflow";
import { conversationExtractionWorkflow } from "./conversation-extraction.workflow";

const maximumBackoffMs = 60 * 60 * 1000;

export async function dispatchConversationProcessingOutboxEvent(eventId: string): Promise<boolean> {
  const now = new Date();
  const event = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      eventType: true,
      aggregateId: true,
      attempts: true,
      availableAt: true,
    },
  });
  if (!event || !["conversation.processing.requested", "conversation.extraction.requested"].includes(event.eventType)) return false;
  if (event.status === "DELIVERED") return true;
  if (event.availableAt > now) return false;
  const claimed = await prisma.outboxEvent.updateMany({
    where: { id: event.id, status: { in: ["PENDING", "FAILED", "PROCESSING"] }, availableAt: { lte: now } },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      safeError: null,
      availableAt: new Date(now.getTime() + 5 * 60 * 1000),
    },
  });
  if (claimed.count !== 1) return false;
  try {
    const workflowRun = await start(event.eventType === "conversation.extraction.requested" ? conversationExtractionWorkflow : conversationTranscriptionWorkflow, [event.aggregateId]);
    await prisma.$transaction(async (tx) => {
      await tx.processingRun.updateMany({
        where: { id: event.aggregateId, workflowRunId: null },
        data: { workflowRunId: workflowRun.runId },
      });
      await tx.outboxEvent.update({
        where: { id: event.id },
        data: { status: "DELIVERED", deliveredAt: new Date(), safeError: null },
      });
    });
    return true;
  } catch (error) {
    const attempts = event.attempts + 1;
    const delayMs = Math.min(maximumBackoffMs, 1_000 * 2 ** Math.min(attempts, 12));
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        safeError: "WORKFLOW_DISPATCH_FAILED",
        availableAt: new Date(Date.now() + delayMs),
      },
    });
    throw error;
  }
}
