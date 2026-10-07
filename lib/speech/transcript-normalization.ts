import { createHash } from "node:crypto";
import type { SpeechJob, SpeechUtterance, SpeechWord } from "./speech-provider";

export const transcriptWarningCodes = [
  "DIARIZATION_UNAVAILABLE",
  "ALIGNMENT_UNAVAILABLE",
] as const;
export type TranscriptWarningCode = (typeof transcriptWarningCodes)[number];

export interface NormalizedEvidenceSegment {
  id: string;
  startOffset: number;
  endOffset: number;
  startMs: number | null;
  endMs: number | null;
  text: string;
  speakerId: string | null;
  confidence: number | null;
}

export interface NormalizedTranscript {
  text: string;
  fingerprint: string;
  language: "en" | "es";
  completedAt: string;
  diarizationStatus: "AVAILABLE" | "UNAVAILABLE";
  warningCode: TranscriptWarningCode | null;
  segments: NormalizedEvidenceSegment[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeConfidence(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function validTimedText(value: { text: string; startMs: number; endMs: number }): boolean {
  return Boolean(value.text) && Number.isInteger(value.startMs) && value.startMs >= 0
    && Number.isInteger(value.endMs) && value.endMs > value.startMs;
}

function stableSegment(
  fingerprint: string,
  text: string,
  startOffset: number,
  endOffset: number,
  timing: { startMs: number | null; endMs: number | null },
  speakerId: string | null,
  confidence: number | null,
): NormalizedEvidenceSegment {
  return {
    id: sha256(`${fingerprint}:${startOffset}:${endOffset}`),
    startOffset,
    endOffset,
    startMs: timing.startMs,
    endMs: timing.endMs,
    text: text.slice(startOffset, endOffset),
    speakerId,
    confidence,
  };
}

function alignUtterances(
  text: string,
  fingerprint: string,
  utterances: SpeechUtterance[],
): NormalizedEvidenceSegment[] | null {
  const valid = utterances.filter((utterance) => validTimedText(utterance) && Boolean(utterance.speakerLabel));
  if (valid.length !== utterances.length || valid.length === 0) return null;
  const speakerIds = new Map<string, string>();
  let cursor = 0;
  const result: NormalizedEvidenceSegment[] = [];
  for (const utterance of valid) {
    const startOffset = text.indexOf(utterance.text, cursor);
    if (startOffset < cursor) return null;
    const endOffset = startOffset + utterance.text.length;
    cursor = endOffset;
    let speakerId = speakerIds.get(utterance.speakerLabel);
    if (!speakerId) {
      speakerId = `speaker_${String.fromCharCode(97 + speakerIds.size)}`;
      speakerIds.set(utterance.speakerLabel, speakerId);
    }
    result.push(stableSegment(
      fingerprint,
      text,
      startOffset,
      endOffset,
      { startMs: utterance.startMs, endMs: utterance.endMs },
      speakerId,
      safeConfidence(utterance.confidence),
    ));
  }
  return result;
}

interface AlignedWord extends SpeechWord { startOffset: number; endOffset: number }

function alignWords(text: string, words: SpeechWord[]): AlignedWord[] | null {
  if (words.length === 0 || words.some((word) => !validTimedText(word))) return null;
  let cursor = 0;
  const aligned: AlignedWord[] = [];
  for (const word of words) {
    const startOffset = text.indexOf(word.text, cursor);
    if (startOffset < cursor) return null;
    const endOffset = startOffset + word.text.length;
    aligned.push({ ...word, startOffset, endOffset });
    cursor = endOffset;
  }
  return aligned;
}

function groupWords(
  text: string,
  fingerprint: string,
  words: SpeechWord[],
): NormalizedEvidenceSegment[] | null {
  const aligned = alignWords(text, words);
  if (!aligned) return null;
  const groups: AlignedWord[][] = [];
  let group: AlignedWord[] = [];
  for (const word of aligned) {
    const previous = group.at(-1);
    const projectedLength = word.endOffset - (group[0]?.startOffset ?? word.startOffset);
    const boundary = group.length > 0 && (
      group.length >= 40 || projectedLength > 280
      || (previous ? word.startMs - previous.endMs >= 1_200 : false)
    );
    if (boundary) {
      groups.push(group);
      group = [];
    }
    group.push(word);
    if (/[.!?…][\]"')}]?$/.test(word.text)) {
      groups.push(group);
      group = [];
    }
  }
  if (group.length) groups.push(group);
  return groups.map((items) => {
    const first = items[0]!;
    const last = items.at(-1)!;
    const confidences = items.map((word) => safeConfidence(word.confidence)).filter((value): value is number => value !== null);
    return stableSegment(
      fingerprint,
      text,
      first.startOffset,
      last.endOffset,
      { startMs: first.startMs, endMs: last.endMs },
      null,
      confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null,
    );
  });
}

export function normalizeCompletedSpeechJob(
  job: Extract<SpeechJob, { status: "completed" }>,
): NormalizedTranscript {
  const fingerprint = sha256(job.text);
  const utteranceSegments = alignUtterances(job.text, fingerprint, job.utterances);
  if (utteranceSegments) {
    return {
      text: job.text,
      fingerprint,
      language: job.language,
      completedAt: job.completedAt,
      diarizationStatus: "AVAILABLE",
      warningCode: null,
      segments: utteranceSegments,
    };
  }
  const wordSegments = groupWords(job.text, fingerprint, job.words);
  if (wordSegments) {
    return {
      text: job.text,
      fingerprint,
      language: job.language,
      completedAt: job.completedAt,
      diarizationStatus: "UNAVAILABLE",
      warningCode: "DIARIZATION_UNAVAILABLE",
      segments: wordSegments,
    };
  }
  return {
    text: job.text,
    fingerprint,
    language: job.language,
    completedAt: job.completedAt,
    diarizationStatus: "UNAVAILABLE",
    warningCode: "ALIGNMENT_UNAVAILABLE",
    segments: job.text.length > 0
      ? [stableSegment(fingerprint, job.text, 0, job.text.length, { startMs: null, endMs: null }, null, null)]
      : [],
  };
}
