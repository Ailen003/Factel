export type SpeechLanguage = "en" | "es";

export interface SpeechWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number | null;
}

export interface SpeechUtterance {
  text: string;
  startMs: number;
  endMs: number;
  speakerLabel: string;
  confidence?: number | null;
  words?: SpeechWord[];
}

export type SpeechJob =
  | { status: "queued" }
  | { status: "processing" }
  | { status: "error"; errorCode: string }
  | {
      status: "completed";
      text: string;
      language: SpeechLanguage;
      completedAt: string;
      words: SpeechWord[];
      utterances: SpeechUtterance[];
    };

export interface SpeechProvider {
  submit(input: { audioUrl: string; language: SpeechLanguage }): Promise<{ jobId: string }>;
  get(jobId: string): Promise<SpeechJob>;
  delete(jobId: string): Promise<void>;
}

export class SpeechProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "SpeechProviderError";
  }
}
