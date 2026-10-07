import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import type { ProposalField } from "../lib/types/proposal.types";
import ConversationReviewEvidence from "./conversation-review-evidence";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
const field: ProposalField = { target: "client", itemId: null, fieldKey: "name", observedValue: "Maria", normalizedValue: "Maria",
  provenance: "extracted", confidence: null, evidenceIds: ["segment-a"] };
const transcript: NonNullable<ConversationDetails["transcript"]> = { text: "My name is Maria.", locale: "en", completedAt: "2026-09-08T00:00:00.000Z",
  diarizationStatus: "unavailable", warningCode: null, segments: [
    { id: "segment-a", startMs: 1500, endMs: 3000, startOffset: 0, endOffset: 17, text: "My name is Maria.", speakerId: null, confidence: null },
    { id: "unrelated", startMs: 4000, endMs: 5000, startOffset: 17, endOffset: 25, text: "Unrelated", speakerId: null, confidence: null },
  ] };

describe("ConversationReviewEvidence", () => {
  it("highlights only related immutable evidence and seeks its original timestamp", () => {
    const seek = vi.fn();
    const { container } = render(<ConversationReviewEvidence field={field} transcript={transcript} onSeek={seek} canSeek />);
    expect(container.querySelector("mark")?.textContent).toBe("My name is Maria.");
    expect(screen.queryByText("Unrelated")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "listenEvidence" }));
    expect(seek).toHaveBeenCalledWith(1500);
  });
  it("keeps evidence readable when no timestamp was provided", () => {
    render(<ConversationReviewEvidence field={field} transcript={{ ...transcript, segments: [{ ...transcript.segments[0], startMs: null, endMs: null }] }} onSeek={vi.fn()} canSeek />);
    expect(screen.getByText("My name is Maria.")).toBeTruthy();
    expect(screen.getByText("noTimestamp")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "listenEvidence" })).toBeNull();
  });
});
