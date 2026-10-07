import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import ConversationTranscriptView from "./conversation-transcript-view";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, string>) => values
      ? `${key} ${Object.values(values).join(" ")}`
      : key;
    translate.has = () => true;
    return translate;
  },
  useFormatter: () => ({
    dateTime: () => "Jan 1, 2026",
    number: (value: number) => `${Math.round(value * 100)}%`,
  }),
}));

const transcript: NonNullable<ConversationDetails["transcript"]> = {
  text: "Hello   world\nNew line",
  locale: "en",
  completedAt: "2026-01-01T00:01:00.000Z",
  diarizationStatus: "unavailable",
  warningCode: "ALIGNMENT_FALLBACK",
  segments: [
    { id: "global", startMs: null, endMs: null, startOffset: 0, endOffset: 22, text: "Hello   world\nNew line", speakerId: null, confidence: null },
    { id: "speaker", startMs: 1_000, endMs: 2_500, startOffset: 0, endOffset: 5, text: "Hello", speakerId: "speaker_a", confidence: 0.92 },
  ],
};

describe("ConversationTranscriptView", () => {
  it("preserves original whitespace and keeps global fallback evidence visible", () => {
    const { container } = render(<ConversationTranscriptView transcript={transcript} />);
    expect(container.querySelector("#original-transcript-title + p")?.textContent).toBe("Hello   world\nNew line");
    expect(container.querySelector("ol li p")?.textContent).toBe("Hello   world\nNew line");
    expect(screen.getByText("segments.evidence")).toBeTruthy();
  });

  it("shows generic speaker labels, timing and optional confidence", () => {
    render(<ConversationTranscriptView transcript={transcript} />);
    expect(screen.getByText(/segments\.speaker A/)).toBeTruthy();
    expect(screen.getByText(/0:01.*0:02/)).toBeTruthy();
    expect(screen.getByText(/92%/)).toBeTruthy();
  });
});
