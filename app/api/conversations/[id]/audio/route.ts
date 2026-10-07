import { getConversationAudioObject } from "@/modules/conversations/lib/services/conversation.services";
import { readObjectBytes } from "@/lib/storage/storage.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ByteRange = { start: number; end: number };

function parseByteRange(value: string | null, total: number): ByteRange | null | "invalid" {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return "invalid";
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : total - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= total ||
    requestedEnd < start
  ) {
    return "invalid";
  }
  return { start, end: Math.min(requestedEnd, total - 1) };
}

function jsonError(code: string, status: number, extraHeaders?: HeadersInit) {
  return Response.json(
    { error: { code, message: code } },
    { status, headers: { "Cache-Control": "private, no-store", ...extraHeaders } },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await getConversationAudioObject(id, request.headers);
  if (!access.success) {
    if (access.error.code === "UNAUTHENTICATED") return jsonError(access.error.code, 401);
    if (
      access.error.code === "ACCOUNT_INACTIVE" ||
      access.error.code === "TEMPORARY_PASSWORD_CHANGE_REQUIRED" ||
      access.error.code === "TEMPORARY_PASSWORD_EXPIRED"
    ) return jsonError(access.error.code, 403);
    return jsonError("NOT_FOUND", 404);
  }

  const range = parseByteRange(request.headers.get("range"), access.data.byteSize);
  if (range === "invalid") {
    return jsonError("INVALID_RANGE", 416, {
      "Content-Range": `bytes */${access.data.byteSize}`,
      "Accept-Ranges": "bytes",
    });
  }

  try {
    const selected = range ?? { start: 0, end: access.data.byteSize - 1 };
    const object = await readObjectBytes(
      access.data.storageKey,
      selected.end - selected.start + 1,
      range ?? undefined,
    );
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Length": String(object.bytes.byteLength),
      "Content-Type": access.data.mimeType,
      ETag: object.etag,
      "X-Content-Type-Options": "nosniff",
    });
    if (range) {
      headers.set(
        "Content-Range",
        object.contentRange ?? `bytes ${range.start}-${range.end}/${access.data.byteSize}`,
      );
    }
    return new Response(new Blob([object.bytes]), {
      status: range ? 206 : 200,
      headers,
    });
  } catch {
    return jsonError("AUDIO_UNAVAILABLE", 503);
  }
}
