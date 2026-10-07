import type { PropsWithChildren } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import ConversationRecordingForm from "./conversation-recording-form";
import type { ConversationRecordingSchema } from "./schemas/conversation-recording-schema";

const policy = {
  maximumBytes: 25 * 1024 * 1024,
  maximumDurationMs: 600_000,
  grantExpiresInSeconds: 900,
  permittedMimeTypes: ["audio/webm"],
};

function Providers({ children }: PropsWithChildren) {
  const form = useForm<ConversationRecordingSchema>({ defaultValues: { consent: true, locale: "en" } });
  return <NextIntlClientProvider locale="en" messages={messages}>
    <FormProvider {...form}>{children}</FormProvider>
  </NextIntlClientProvider>;
}

const baseProps = {
  elapsedMs: 65_000,
  activity: 42,
  previewUrl: null,
  file: null,
  error: null,
  notice: null,
  policy,
  uploadStage: "idle" as const,
  uploadProgress: 0,
  uploadError: null,
  canRetryUpload: false,
  onStop: vi.fn(),
  onReset: vi.fn(),
  onSave: vi.fn(),
  onRequestDiscard: vi.fn(),
  onCancel: vi.fn(),
};

describe("conversation recording form", () => {
  it("exposes persistent recording status, elapsed time, activity and stop control", () => {
    const onStop = vi.fn();
    render(<ConversationRecordingForm {...baseProps} stage="recording" onStop={onStop} />, { wrapper: Providers });

    expect(screen.getByRole("status").textContent).toContain("Recording in progress");
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Microphone activity" }).getAttribute("aria-valuenow")).toBe("42");
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("offers playback, save and discard only after a local recording exists", () => {
    const onSave = vi.fn();
    const onRequestDiscard = vi.fn();
    const file = new File(["audio"], "conversation.webm", { type: "audio/webm" });
    const { container } = render(<ConversationRecordingForm {...baseProps} stage="review"
      previewUrl="blob:recording" file={file} onSave={onSave} onRequestDiscard={onRequestDiscard} />, { wrapper: Providers });

    expect(container.querySelector("audio")?.getAttribute("src")).toBe("blob:recording");
    fireEvent.click(screen.getByRole("button", { name: "Save conversation" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard recording" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onRequestDiscard).toHaveBeenCalledOnce();
  });
});
