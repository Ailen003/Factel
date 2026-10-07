import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConversationProcessingPanel from "./conversation-processing-panel";
import type { ConversationProcessingView } from "./conversation-processing-view";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.has = () => true;
    return translate;
  },
}));

const ready: ConversationProcessingView = {
  credits: { available: 9, reserved: 1, consumed: 0 },
  run: null,
  transcript: null,
  canStart: true,
};

describe("ConversationProcessingPanel", () => {
  it("directs a failed reprocessing run to the preserved review instead of the unavailable Process action", () => {
    render(<ConversationProcessingPanel view={{ ...ready, canStart: false, hasPreservedReview: true,
      run: { id: "run-a", status: "failed", stage: "extracting", retryable: false, failureCode: "EXTRACTION_INVALID_RESPONSE" },
    }} onProcess={vi.fn()} isStarting={false} startError={null} />);
    expect(screen.getByText("preservedReviewFailure")).toBeTruthy();
    expect(screen.queryByText("notRetryable")).toBeNull();
    expect(screen.queryByRole("button", { name: "start" })).toBeNull();
  });
  it("exposes the process action only when eligible and reports its busy state", () => {
    const onProcess = vi.fn();
    const { rerender } = render(<ConversationProcessingPanel view={ready} onProcess={onProcess} isStarting={false} startError={null} />);
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(onProcess).toHaveBeenCalledOnce();

    rerender(<ConversationProcessingPanel view={ready} onProcess={onProcess} isStarting startError={null} />);
    expect(screen.getByRole("button", { name: "starting" }).getAttribute("aria-busy")).toBe("true");

    rerender(<ConversationProcessingPanel view={{ ...ready, canStart: false, credits: { available: 0, reserved: 1, consumed: 0 } }}
      onProcess={onProcess} isStarting={false} startError={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("noCredits")).toBeTruthy();
  });

  it("announces an active persisted stage with progress", () => {
    render(<ConversationProcessingPanel view={{
      ...ready,
      canStart: false,
      run: { id: "run-a", status: "running", stage: "diarizing", retryable: false, failureCode: null },
    }} onProcess={() => undefined} isStarting={false} startError={null} />);
    expect(screen.getByText("stages.diarizing")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
});
