import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import ConversationDetailsContainer from "./conversation-details-container";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  current: null as ConversationDetails | null,
}));
const translate = Object.assign((key: string) => key, { has: () => true });

vi.mock("next-intl", () => ({ useTranslations: () => translate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("./use-conversation-details", () => ({
  default: () => ({ conversation: mocks.current, isLoading: false, error: null, reload: vi.fn() }),
}));
vi.mock("../processing/use-start-conversation-processing", () => ({
  default: () => ({ execute: vi.fn(), isLoading: false, error: null }),
}));
vi.mock("../processing/use-continue-conversation-extraction", () => ({
  default: () => ({ execute: vi.fn(), isLoading: false, error: null }),
}));
vi.mock("./conversation-details-presentational", () => ({
  default: ({ conversation }: { conversation: ConversationDetails }) => <div>{conversation.status}</div>,
}));

function details(status: ConversationDetails["status"]): ConversationDetails {
  return {
    id: "conversation-a", sourceType: "upload", locale: "en", status, version: 1,
    durationMs: 1_000, originalFilename: "sample.webm", createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z", audio: null,
    credits: { available: 9, reserved: 1, consumed: 0 }, processingRun: null, transcript: null,
  };
}

describe("ConversationDetailsContainer", () => {
  it.each(["transcribed", "failed"] as const)("refreshes the SSR list when active processing reaches %s", (terminalStatus) => {
    mocks.refresh.mockReset();
    mocks.current = details("transcribing");
    const { rerender } = render(<ConversationDetailsContainer conversationId="conversation-a" />);
    mocks.current = details(terminalStatus);
    rerender(<ConversationDetailsContainer conversationId="conversation-a" />);
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
