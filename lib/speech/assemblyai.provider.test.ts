import { describe, expect, it, vi } from "vitest";
import { AssemblyAiSpeechProvider } from "./assemblyai.provider";

describe("AssemblyAI speech provider", () => {
  it("submits fixed models, known language, and speaker labels", async () => {
    const submit = vi.fn().mockResolvedValue({ id: "job-a" });
    const provider = new AssemblyAiSpeechProvider({ transcripts: { submit } } as never);
    await expect(provider.submit({ audioUrl: "https://signed.example/audio", language: "es" }))
      .resolves.toEqual({ jobId: "job-a" });
    expect(submit).toHaveBeenCalledWith({
      audio: "https://signed.example/audio",
      language_code: "es",
      speaker_labels: true,
      speech_models: ["universal-3-5-pro", "universal-2"],
    });
  });

  it("normalizes completed utterances without returning provider-only fields", async () => {
    const get = vi.fn().mockResolvedValue({
      id: "job-a",
      status: "completed",
      text: "Hello",
      language_code: "en",
      words: [{ text: "Hello", start: 0, end: 500, confidence: 0.9 }],
      utterances: [{ text: "Hello", start: 0, end: 500, speaker: "A", confidence: 0.9, words: [] }],
      audio_url: "secret-url-that-must-not-leak",
    });
    const provider = new AssemblyAiSpeechProvider({ transcripts: { get } } as never);
    await expect(provider.get("job-a")).resolves.toMatchObject({
      status: "completed",
      text: "Hello",
      language: "en",
      words: [{ text: "Hello", startMs: 0, endMs: 500, confidence: 0.9 }],
      utterances: [{ text: "Hello", startMs: 0, endMs: 500, speakerLabel: "A" }],
    });
    expect(JSON.stringify(await provider.get("job-a"))).not.toContain("secret-url");
  });

  it("maps provider terminal jobs to a stable safe code", async () => {
    const get = vi.fn().mockResolvedValue({ status: "error", error: "raw provider details" });
    const provider = new AssemblyAiSpeechProvider({ transcripts: { get } } as never);
    await expect(provider.get("job-a")).resolves.toEqual({
      status: "error",
      errorCode: "SPEECH_TRANSCRIPTION_FAILED",
    });
  });

  it("treats an already deleted remote transcript as idempotent cleanup success", async () => {
    const remove = vi.fn().mockRejectedValue({ status: 404 });
    const provider = new AssemblyAiSpeechProvider({ transcripts: { delete: remove } } as never);

    await expect(provider.delete("job-missing")).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith("job-missing");
  });
});
