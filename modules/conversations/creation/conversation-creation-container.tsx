"use client";

import { useEffect } from "react";
import useConversationCreation from "../lib/hooks/use-conversation-creation";
import type { ConversationCreationState } from "../lib/types/conversation-creation.types";
import ConversationCreationPresentational from "./conversation-creation-presentational";

export default function ConversationCreationContainer({ conversationId, status, eligible, onStateChange, onChanged, onGuardChange }: {
  conversationId: string; status: string; eligible: boolean;
  onStateChange: (state: ConversationCreationState) => void;
  onChanged: () => void | Promise<void>;
  onGuardChange: (guard: { busy: boolean; active: boolean }) => void;
}) {
  const creation = useConversationCreation({ conversationId, recover: ["record_plan_pending", "completed"].includes(status), completed: status === "completed", onStateChange, onChanged });
  useEffect(() => { onGuardChange({ busy: creation.isLoading || creation.uncertain, active: creation.active }); }, [creation.isLoading, creation.uncertain, creation.active, onGuardChange]);
  if (!["ready", "record_plan_pending", "completed"].includes(status) && !creation.active) return null;
  return <ConversationCreationPresentational creation={creation} eligible={eligible} />;
}
