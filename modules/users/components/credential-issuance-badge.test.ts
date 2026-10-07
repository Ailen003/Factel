import { describe, expect, it } from "vitest";
import type { TemporaryCredentialIssuanceMetadata } from "../lib/types/temporary-credential-reissue.types";
import { getCredentialIssuanceDisplayStatus } from "./credential-issuance-badge";

const issuance: TemporaryCredentialIssuanceMetadata = {
  id: "issuance-1",
  version: 1,
  purpose: "activation",
  reason: "expired_credential",
  status: "issued",
  preparedAt: "2026-09-10T00:00:00.000Z",
  issuedAt: "2026-09-10T00:00:01.000Z",
  expiresAt: "2026-09-13T00:00:01.000Z",
  deliveredAt: null,
  deliveryChannel: null,
};

describe("credential issuance display status", () => {
  it("distinguishes unconfirmed delivery, delivery, and supersession", () => {
    expect(getCredentialIssuanceDisplayStatus(issuance)).toBe("issuedNotDelivered");
    expect(getCredentialIssuanceDisplayStatus({
      ...issuance,
      deliveredAt: "2026-09-10T00:05:00.000Z",
      deliveryChannel: "in_person",
    })).toBe("delivered");
    expect(getCredentialIssuanceDisplayStatus({
      ...issuance,
      status: "superseded",
    })).toBe("superseded");
  });
});
