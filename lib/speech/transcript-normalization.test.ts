import { describe, expect, it } from "vitest";
import { normalizeCompletedSpeechJob } from "./transcript-normalization";

describe("transcript normalization", () => {
  it("preserves literal multilingual text and maps provider speakers to stable generic ids", () => {
    const text = "Hola,  señor.\n¿Cómo está?";
    const result = normalizeCompletedSpeechJob({
      status: "completed",
      text,
      language: "es",
      completedAt: "2026-09-07T12:00:00.000Z",
      words: [],
      utterances: [
        { text: "Hola,  señor.", startMs: 0, endMs: 1_000, speakerLabel: "A", confidence: 0.91 },
        { text: "¿Cómo está?", startMs: 1_200, endMs: 2_000, speakerLabel: "B" },
      ],
    });

    expect(result.text).toBe(text);
    expect(result.diarizationStatus).toBe("AVAILABLE");
    expect(result.segments.map((segment) => segment.speakerId)).toEqual(["speaker_a", "speaker_b"]);
    expect(result.segments.map((segment) => text.slice(segment.startOffset, segment.endOffset)))
      .toEqual(["Hola,  señor.", "¿Cómo está?"]);
  });

  it("creates deterministic word groups when diarization is absent", () => {
    const input = {
      status: "completed" as const,
      text: "One sentence. Next part",
      language: "en" as const,
      completedAt: "2026-09-07T12:00:00.000Z",
      utterances: [],
      words: [
        { text: "One", startMs: 0, endMs: 100 },
        { text: "sentence.", startMs: 110, endMs: 300 },
        { text: "Next", startMs: 2_000, endMs: 2_200 },
        { text: "part", startMs: 2_250, endMs: 2_400 },
      ],
    };
    const first = normalizeCompletedSpeechJob(input);
    const second = normalizeCompletedSpeechJob(input);
    expect(first.warningCode).toBe("DIARIZATION_UNAVAILABLE");
    expect(first.segments).toHaveLength(2);
    expect(first.segments.map(({ id }) => id)).toEqual(second.segments.map(({ id }) => id));
  });

  it("uses one global evidence fragment instead of publishing unsafe offsets", () => {
    const result = normalizeCompletedSpeechJob({
      status: "completed",
      text: "Provider canonical text",
      language: "en",
      completedAt: "2026-09-07T12:00:00.000Z",
      utterances: [{ text: "different text", startMs: 0, endMs: 100, speakerLabel: "A" }],
      words: [{ text: "missing", startMs: 0, endMs: 100 }],
    });
    expect(result.warningCode).toBe("ALIGNMENT_UNAVAILABLE");
    expect(result.segments).toEqual([
      expect.objectContaining({ startOffset: 0, endOffset: 23, text: "Provider canonical text", startMs: null, endMs: null }),
    ]);
  });
});
