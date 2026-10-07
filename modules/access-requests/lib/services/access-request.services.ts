import "server-only";

import type { ServiceResponse } from "@/lib/api-responses";
import { resolveAccessContactEmail } from "@/modules/platform-settings/lib/services/platform-settings.services";
import type {
  AccessRequestDto,
  PreparedAccessRequest,
} from "../types/access-request.types";

export async function prepareAccessRequest(
  _request: AccessRequestDto,
): Promise<ServiceResponse<PreparedAccessRequest>> {
  // The request is deliberately not persisted or logged. The browser uses the
  // validated values to compose a message in the visitor's own mail client.
  return resolveAccessContactEmail();
}
