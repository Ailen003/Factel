import { timingSafeEqual } from "node:crypto";
import { reconcileConversationProcessingOutbox } from "@/modules/conversations/lib/services/processing.services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json(
      { error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED" } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return Response.json(await reconcileConversationProcessingOutbox(), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Conversation processing reconciliation failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "INTERNAL_ERROR" } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
