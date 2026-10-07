import "server-only";

import { AssemblyAI } from "assemblyai";
import type {
  SpeechJob,
  SpeechProvider,
  SpeechUtterance,
  SpeechWord,
} from "./speech-provider";
import { SpeechProviderError } from "./speech-provider";

const speechModels = ["universal-3-5-pro", "universal-2"] as const;

type AssemblyTranscript = Awaited<ReturnType<AssemblyAI["transcripts"]["get"]>>;

function environmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SpeechProviderError("SPEECH_PROVIDER_NOT_CONFIGURED", false);
  return value;
}

function normalizeOptionalBaseUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new SpeechProviderError("SPEECH_PROVIDER_NOT_CONFIGURED", false);
  }
  if (url.protocol !== "https:") {
    throw new SpeechProviderError("SPEECH_PROVIDER_NOT_CONFIGURED", false);
  }
  return url.toString().replace(/\/$/, "");
}

function word(value: { text?: string; start?: number; end?: number; confidence?: number | null }): SpeechWord | null {
  if (!value.text || !Number.isInteger(value.start) || !Number.isInteger(value.end)) return null;
  return {
    text: value.text,
    startMs: value.start!,
    endMs: value.end!,
    confidence: value.confidence,
  };
}

function utterance(value: {
  text?: string;
  start?: number;
  end?: number;
  speaker?: string;
  confidence?: number | null;
  words?: Array<{ text?: string; start?: number; end?: number; confidence?: number | null }>;
}): SpeechUtterance | null {
  if (!value.text || !value.speaker || !Number.isInteger(value.start) || !Number.isInteger(value.end)) return null;
  return {
    text: value.text,
    startMs: value.start!,
    endMs: value.end!,
    speakerLabel: value.speaker,
    confidence: value.confidence,
    words: value.words?.map(word).filter((item): item is SpeechWord => item !== null),
  };
}

function providerHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) ? status : undefined;
}

function safeProviderFailure(error: unknown): SpeechProviderError {
  if (error instanceof SpeechProviderError) return error;
  const status = providerHttpStatus(error);
  const retryable = status === undefined || status === 408 || status === 429 || status >= 500;
  return new SpeechProviderError(retryable ? "SPEECH_PROVIDER_TEMPORARY" : "SPEECH_PROVIDER_REJECTED", retryable);
}

export class AssemblyAiSpeechProvider implements SpeechProvider {
  constructor(private readonly client: AssemblyAI) {}

  async submit(input: { audioUrl: string; language: "en" | "es" }): Promise<{ jobId: string }> {
    try {
      const transcript = await this.client.transcripts.submit({
        audio: input.audioUrl,
        language_code: input.language,
        speaker_labels: true,
        speech_models: [...speechModels],
      });
      if (!transcript.id) throw new SpeechProviderError("SPEECH_PROVIDER_INVALID_RESPONSE", false);
      return { jobId: transcript.id };
    } catch (error) {
      throw safeProviderFailure(error);
    }
  }

  async get(jobId: string): Promise<SpeechJob> {
    try {
      const transcript: AssemblyTranscript = await this.client.transcripts.get(jobId);
      if (transcript.status === "queued" || transcript.status === "processing") {
        return { status: transcript.status };
      }
      if (transcript.status === "error") {
        return { status: "error", errorCode: "SPEECH_TRANSCRIPTION_FAILED" };
      }
      if (transcript.status !== "completed" || typeof transcript.text !== "string") {
        throw new SpeechProviderError("SPEECH_PROVIDER_INVALID_RESPONSE", false);
      }
      const words = (transcript.words ?? []).map(word).filter((item): item is SpeechWord => item !== null);
      const utterances = (transcript.utterances ?? []).map(utterance).filter((item): item is SpeechUtterance => item !== null);
      return {
        status: "completed",
        text: transcript.text,
        language: transcript.language_code === "es" ? "es" : "en",
        completedAt: new Date().toISOString(),
        words,
        utterances,
      };
    } catch (error) {
      throw safeProviderFailure(error);
    }
  }

  async delete(jobId: string): Promise<void> {
    try {
      await this.client.transcripts.delete(jobId);
    } catch (error) {
      if (providerHttpStatus(error) === 404) return;
      throw safeProviderFailure(error);
    }
  }
}

export function createProductionSpeechProvider(): SpeechProvider {
  const baseUrl = normalizeOptionalBaseUrl(process.env.ASSEMBLYAI_BASE_URL);
  return new AssemblyAiSpeechProvider(new AssemblyAI({
    apiKey: environmentValue("ASSEMBLYAI_API_KEY"),
    ...(baseUrl ? { baseUrl } : {}),
  }));
}
