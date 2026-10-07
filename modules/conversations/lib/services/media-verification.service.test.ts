import { describe, expect, it } from "vitest";
import { verifyConversationMedia } from "./media-verification.service";

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function encodeSize(size: number): Uint8Array {
  for (let length = 1; length <= 4; length++) {
    if (size >= 2 ** (7 * length) - 1) continue;
    let encoded = BigInt(size) | (BigInt(1) << BigInt(7 * length));
    const bytes = new Uint8Array(length);
    for (let index = length - 1; index >= 0; index--) {
      bytes[index] = Number(encoded & BigInt(0xff));
      encoded >>= BigInt(8);
    }
    return bytes;
  }
  throw new Error("Test EBML element is too large");
}

function element(id: number[], data: Uint8Array): Uint8Array {
  return concatenate(Uint8Array.from(id), encodeSize(data.length), data);
}

function streamingElement(id: number[], data: Uint8Array): Uint8Array {
  return concatenate(Uint8Array.from(id), Uint8Array.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]), data);
}

function unsigned(value: number): Uint8Array {
  const bytes: number[] = [];
  let remaining = value;
  do {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  } while (remaining > 0);
  return Uint8Array.from(bytes);
}

function float32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value);
  return bytes;
}

function mediaRecorderWebmWithoutDeclaredDuration(): Uint8Array {
  const info = element([0x15, 0x49, 0xa9, 0x66],
    element([0x2a, 0xd7, 0xb1], unsigned(1_000_000)));
  const audio = element([0xe1], concatenate(
    element([0xb5], float32(48_000)),
    element([0x9f], unsigned(1)),
  ));
  const track = element([0xae], concatenate(
    element([0xd7], unsigned(1)),
    element([0x73, 0xc5], unsigned(1)),
    element([0x83], unsigned(2)),
    element([0x23, 0xe3, 0x83], unsigned(20_000_000)),
    element([0x86], new TextEncoder().encode("A_OPUS")),
    audio,
  ));
  const tracks = element([0x16, 0x54, 0xae, 0x6b], track);
  const cluster = (timecode: number, data: Uint8Array = new Uint8Array()) => streamingElement([0x1f, 0x43, 0xb6, 0x75], concatenate(
    element([0xe7], unsigned(timecode)),
    element([0xa3], Uint8Array.from([0x81, 0x00, 0x00, 0x80, 0xf8, 0xff])),
    data,
  ));
  const segment = streamingElement([0x18, 0x53, 0x80, 0x67], concatenate(info, tracks, cluster(0, cluster(2_000))));
  const header = element([0x1a, 0x45, 0xdf, 0xa3],
    element([0x42, 0x82], new TextEncoder().encode("webm")));
  return concatenate(header, segment);
}

function pcmWave(durationSeconds: number): Uint8Array {
  const sampleRate = 8_000;
  const sampleCount = sampleRate * durationSeconds;
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe("conversation media verification", () => {
  it("detects audio from bytes and returns canonical metadata", async () => {
    const result = await verifyConversationMedia(pcmWave(1), 2_000);
    expect(result).toMatchObject({
      success: true,
      data: { mimeType: "audio/wav", durationMs: 1_000 },
    });
  });

  it("rejects corrupt content and audio beyond the configured duration", async () => {
    await expect(verifyConversationMedia(new Uint8Array([1, 2, 3]), 2_000)).resolves.toEqual({
      success: false,
      code: "MEDIA_VERIFICATION_FAILED",
    });
    await expect(verifyConversationMedia(pcmWave(2), 1_000)).resolves.toEqual({
      success: false,
      code: "MEDIA_TOO_LONG",
    });
  });

  it("derives duration from WebM blocks when MediaRecorder omits Info.Duration", async () => {
    const bytes = mediaRecorderWebmWithoutDeclaredDuration();

    await expect(verifyConversationMedia(bytes, 2_500)).resolves.toMatchObject({
      success: true,
      data: { mimeType: "audio/webm", durationMs: 2_020 },
    });
    await expect(verifyConversationMedia(bytes, 2_000)).resolves.toEqual({
      success: false,
      code: "MEDIA_TOO_LONG",
    });
  });
});
