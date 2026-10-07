import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const DEFAULT_REGION = "us-east-1";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;
const MAX_SIGNED_URL_TTL_SECONDS = 60 * 60;

type StorageProvider = "aws" | "s3" | "supabase";

export interface StoredObject {
  key: string;
  publicUrl: string | null;
}

export interface UploadObjectInput {
  body: PutObjectCommandInput["Body"];
  contentType: string;
  folder: string;
  filename: string;
  metadata?: Record<string, string>;
}

export interface SignedUpload {
  key: string;
  url: string;
  expiresIn: number;
}

export interface StoredObjectHead {
  byteSize: number;
  contentType: string | null;
  etag: string;
}

export interface StoredObjectBytes extends StoredObjectHead {
  bytes: Uint8Array;
  contentRange: string | null;
}

interface StorageConfig {
  accessKeyId: string;
  bucket: string;
  endpoint?: string;
  provider: StorageProvider;
  publicUrl?: string;
  region: string;
  secretAccessKey: string;
}

let client: S3Client | undefined;
let clientFingerprint: string | undefined;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Storage is not configured: ${name} is required.`);
  }

  return value;
}

function normalizeBaseUrl(value: string, name: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Storage is not configured: ${name} must be a valid URL.`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      `Storage is not configured: ${name} must use http or https.`,
    );
  }

  return url.toString().replace(/\/$/, "");
}

function getStorageConfig(): StorageConfig {
  const providerValue = (process.env.STORAGE_PROVIDER ?? "supabase")
    .trim()
    .toLowerCase();

  if (
    providerValue !== "aws" &&
    providerValue !== "supabase" &&
    providerValue !== "s3"
  ) {
    throw new Error(
      'Storage is not configured: STORAGE_PROVIDER must be "supabase", "aws", or "s3".',
    );
  }

  const endpointValue = process.env.STORAGE_ENDPOINT?.trim();
  const publicUrlValue = process.env.STORAGE_PUBLIC_URL?.trim();

  if (providerValue === "supabase" && !endpointValue) {
    throw new Error(
      "Storage is not configured: STORAGE_ENDPOINT is required for Supabase.",
    );
  }

  return {
    accessKeyId: requiredEnvironmentValue("STORAGE_ACCESS_KEY"),
    bucket: requiredEnvironmentValue("STORAGE_BUCKET"),
    endpoint: endpointValue
      ? normalizeBaseUrl(endpointValue, "STORAGE_ENDPOINT")
      : undefined,
    provider: providerValue,
    publicUrl: publicUrlValue
      ? normalizeBaseUrl(publicUrlValue, "STORAGE_PUBLIC_URL")
      : undefined,
    region: process.env.STORAGE_REGION?.trim() || DEFAULT_REGION,
    secretAccessKey: requiredEnvironmentValue("STORAGE_SECRET_KEY"),
  };
}

function getStorageClient(config: StorageConfig): S3Client {
  const fingerprint = JSON.stringify([
    config.provider,
    config.region,
    config.endpoint,
    config.accessKeyId,
    config.secretAccessKey,
  ]);

  if (!client || clientFingerprint !== fingerprint) {
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle:
        config.provider === "supabase" ||
        (config.provider === "s3" && Boolean(config.endpoint)),
    });
    clientFingerprint = fingerprint;
  }

  return client;
}

function normalizePath(value: string, kind: "folder" | "object key"): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");

  if (
    !normalized ||
    normalized
      .split("/")
      .some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(
      `Storage ${kind} must contain safe, non-empty path segments.`,
    );
  }

  return normalized;
}

function extractExtension(filename: string): string {
  const leafName = filename.replace(/\\/g, "/").split("/").at(-1) ?? "";
  const dotIndex = leafName.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === leafName.length - 1) {
    return "";
  }

  const extension = leafName.slice(dotIndex).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(extension) ? extension : "";
}

function normalizeExpiresIn(expiresIn?: number): number {
  const value = expiresIn ?? DEFAULT_SIGNED_URL_TTL_SECONDS;

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_SIGNED_URL_TTL_SECONDS
  ) {
    throw new Error(
      `Signed URL lifetime must be an integer between 1 and ${MAX_SIGNED_URL_TTL_SECONDS} seconds.`,
    );
  }

  return value;
}

function createObjectKey(folder: string, filename: string): string {
  return `${normalizePath(folder, "folder")}/${randomUUID()}${extractExtension(filename)}`;
}

function encodeObjectKey(key: string): string {
  return normalizePath(key, "object key")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export async function upload(
  file: File,
  folder: string,
): Promise<StoredObject> {
  return uploadObject({
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
    filename: file.name,
    folder,
  });
}

export async function uploadObject(
  input: UploadObjectInput,
): Promise<StoredObject> {
  const config = getStorageConfig();
  const key = createObjectKey(input.folder, input.filename);

  await getStorageClient(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata,
    }),
  );

  return { key, publicUrl: getPublicUrl(key) };
}

export async function createSignedUploadUrl(
  input: Omit<UploadObjectInput, "body">,
  expiresIn?: number,
): Promise<SignedUpload> {
  const config = getStorageConfig();
  const key = createObjectKey(input.folder, input.filename);
  const lifetime = normalizeExpiresIn(expiresIn);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
    Metadata: input.metadata,
  });

  return {
    key,
    url: await getSignedUrl(getStorageClient(config), command, {
      expiresIn: lifetime,
    }),
    expiresIn: lifetime,
  };
}

export async function createSignedUploadUrlForKey(
  input: {
    key: string;
    contentType: string;
  },
  expiresIn?: number,
): Promise<SignedUpload> {
  const config = getStorageConfig();
  const key = normalizePath(input.key, "object key");
  const lifetime = normalizeExpiresIn(expiresIn);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
  });

  return {
    key,
    url: await getSignedUrl(getStorageClient(config), command, {
      expiresIn: lifetime,
    }),
    expiresIn: lifetime,
  };
}

export async function createSignedDownloadUrl(
  key: string,
  expiresIn?: number,
): Promise<string> {
  const config = getStorageConfig();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: normalizePath(key, "object key"),
  });

  return getSignedUrl(getStorageClient(config), command, {
    expiresIn: normalizeExpiresIn(expiresIn),
  });
}

export async function objectExists(key: string): Promise<boolean> {
  const config = getStorageConfig();

  try {
    await getStorageClient(config).send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: normalizePath(key, "object key"),
      }),
    );
    return true;
  } catch (error) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;

    if (statusCode === 404) {
      return false;
    }

    throw error;
  }
}

export async function headObject(key: string): Promise<StoredObjectHead> {
  const config = getStorageConfig();
  const response = await getStorageClient(config).send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: normalizePath(key, "object key"),
    }),
  );
  const byteSize = response.ContentLength;
  const etag = response.ETag;
  if (typeof byteSize !== "number" || !Number.isSafeInteger(byteSize) || !etag) {
    throw new Error("Storage object metadata is incomplete.");
  }
  return {
    byteSize,
    contentType: response.ContentType ?? null,
    etag,
  };
}

export async function readObjectBytes(
  key: string,
  maximumBytes: number,
  range?: { start: number; end: number },
): Promise<StoredObjectBytes> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("Storage read limit must be a positive safe integer.");
  }
  if (
    range &&
    (!Number.isSafeInteger(range.start) ||
      !Number.isSafeInteger(range.end) ||
      range.start < 0 ||
      range.end < range.start)
  ) {
    throw new Error("Storage byte range is invalid.");
  }
  const config = getStorageConfig();
  const response = await getStorageClient(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: normalizePath(key, "object key"),
      ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
    }),
  );
  if (!response.Body) throw new Error("Storage object body is missing.");
  if (
    typeof response.ContentLength === "number" &&
    response.ContentLength > maximumBytes
  ) {
    throw new Error("Storage object exceeds the bounded read limit.");
  }
  const bytes = await response.Body.transformToByteArray();
  if (bytes.byteLength > maximumBytes) {
    throw new Error("Storage object exceeds the bounded read limit.");
  }
  const etag = response.ETag;
  if (!etag) throw new Error("Storage object ETag is missing.");
  return {
    bytes,
    byteSize: bytes.byteLength,
    contentType: response.ContentType ?? null,
    contentRange: response.ContentRange ?? null,
    etag,
  };
}

export async function copyObject(
  sourceKey: string,
  destinationKey: string,
  sourceEtag: string,
  contentType: string,
): Promise<void> {
  if (!sourceEtag.trim()) throw new Error("Source ETag is required.");
  const config = getStorageConfig();
  const source = `${config.bucket}/${encodeObjectKey(sourceKey)}`;
  await getStorageClient(config).send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      Key: normalizePath(destinationKey, "object key"),
      CopySource: source,
      CopySourceIfMatch: sourceEtag,
      ContentType: contentType,
      MetadataDirective: "REPLACE",
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  const config = getStorageConfig();

  await getStorageClient(config).send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: normalizePath(key, "object key"),
    }),
  );
}

export function getPublicUrl(key: string): string | null {
  const config = getStorageConfig();

  if (!config.publicUrl) {
    return null;
  }

  return `${config.publicUrl}/${encodeObjectKey(key)}`;
}
