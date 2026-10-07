import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sign: vi.fn().mockResolvedValue("https://storage.example/upload"),
}));

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return {
    ...actual,
    S3Client: class {
      send = mocks.send;
    },
  };
});
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));

import {
  copyObject,
  createSignedUploadUrlForKey,
  headObject,
  readObjectBytes,
} from "./storage.service";

describe("private storage primitives", () => {
  beforeEach(() => {
    Object.assign(process.env, {
      STORAGE_PROVIDER: "s3",
      STORAGE_REGION: "us-east-1",
      STORAGE_ENDPOINT: "https://storage.example",
      STORAGE_BUCKET: "private",
      STORAGE_ACCESS_KEY: "key",
      STORAGE_SECRET_KEY: "secret",
    });
  });

  it("signs only the exact server-provided staging key", async () => {
    const signed = await createSignedUploadUrlForKey({
      key: "conversation-staging/workspace/grant",
      contentType: "audio/mpeg",
    }, 60);
    expect(signed).toEqual({
      key: "conversation-staging/workspace/grant",
      url: "https://storage.example/upload",
      expiresIn: 60,
    });
  });

  it("returns trusted HEAD metadata and enforces a bounded object read", async () => {
    mocks.send
      .mockResolvedValueOnce({ ContentLength: 3, ContentType: "audio/mpeg", ETag: '"etag"' })
      .mockResolvedValueOnce({
        ContentLength: 3,
        ContentType: "audio/mpeg",
        ETag: '"etag"',
        Body: { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])) },
      });
    await expect(headObject("staging/key")).resolves.toEqual({
      byteSize: 3,
      contentType: "audio/mpeg",
      etag: '"etag"',
    });
    await expect(readObjectBytes("staging/key", 3)).resolves.toMatchObject({
      byteSize: 3,
      etag: '"etag"',
    });
    await expect(readObjectBytes("staging/key", 0)).rejects.toThrow("positive safe integer");
  });

  it("copies from staging with the inspected ETag condition", async () => {
    mocks.send.mockResolvedValueOnce({});
    await copyObject("staging/source", "final/object", '"etag"', "audio/mpeg");
    const command = mocks.send.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      Bucket: "private",
      Key: "final/object",
      CopySource: "private/staging/source",
      CopySourceIfMatch: '"etag"',
      MetadataDirective: "REPLACE",
    });
  });
});
