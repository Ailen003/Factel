import { timingSafeEqual } from "node:crypto";
import { reconcileConversationAudioCleanup } from "@/modules/conversations/lib/services/conversation.services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const result = await reconcileConversationAudioCleanup();
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Conversation cleanup failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "INTERNAL_ERROR" } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
