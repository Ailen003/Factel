import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConversationDetails } from "../lib/types/conversation.types";
import ConversationDetailsPresentational from "./conversation-details-presentational";

const translate = Object.assign((key: string) => key, { has: () => true });

vi.mock("../review/conversation-review-container", () => ({
  default: () => <input aria-label="review-draft" defaultValue="original" />,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => translate,
  useFormatter: () => ({
    dateTime: () => "formatted-date",
    number: (value: number) => String(value),
  }),
}));

const conversation: ConversationDetails = {
  id: "conversation-a",
  sourceType: "upload",
  locale: "es",
  status: "transcribed",
  version: 2,
  durationMs: 90_000,
  originalFilename: "sample.webm",
  createdAt: "2026-09-08T12:00:00.000Z",
  updatedAt: "2026-09-08T12:05:00.000Z",
  audio: {
    verificationState: "verified",
    verifiedMimeType: "audio/webm",
    verifiedContainer: "webm",
    byteSize: 1024,
    checksumAlgorithm: "sha256",
    checksum: "checksum",
    playbackPath: "/api/conversations/conversation-a/audio",
  },
  credits: { available: 9, reserved: 1, consumed: 0 },
  processingRun: {
    id: "run-a",
    status: "running",
    stage: "extracting",
    retryable: false,
    failureCode: null,
  },
  transcript: null,
};

describe("ConversationDetailsPresentational", () => {
  it("keeps the same audio player mounted while switching detail tabs", () => {
    const { container } = render(
      <ConversationDetailsPresentational
        conversation={conversation}
        onProcess={vi.fn()}
        isStarting={false}
        startError={null}
      />,
    );
    const player = container.querySelector("audio");

    expect(player).not.toBeNull();
    expect(player?.getAttribute("src")).toBe("/api/conversations/conversation-a/audio");

    const transcriptTab = screen.getByRole("tab", { name: "tabs.transcript" });
    fireEvent.mouseDown(transcriptTab, { button: 0, ctrlKey: false });

    expect(transcriptTab.getAttribute("data-state")).toBe("active");
    expect(container.querySelector("audio")).toBe(player);
  });

  it("opens review by default and preserves its draft and player across tabs and refresh", () => {
    const props = { conversation: { ...conversation, status: "needs_review" as const }, onProcess: vi.fn(), isStarting: false, startError: null };
    const { container, rerender } = render(<ConversationDetailsPresentational {...props} />);
    const player = container.querySelector("audio");
    const draft = screen.getByRole("textbox", { name: "review-draft" });
    expect(screen.getByRole("tab", { name: "tab" }).getAttribute("data-state")).toBe("active");
    fireEvent.change(draft, { target: { value: "human correction" } });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "tabs.information" }), { button: 0, ctrlKey: false });
    expect(screen.queryByRole("textbox", { name: "review-draft" })).toBeNull();
    rerender(<ConversationDetailsPresentational {...props} conversation={{ ...props.conversation, version: 3 }} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "tab" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("textbox", { name: "review-draft" })).toBe(draft);
    expect((draft as HTMLInputElement).value).toBe("human correction");
    expect(container.querySelector("audio")).toBe(player);
  });
});
