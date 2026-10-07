import { describe, expect, it } from "vitest";
import {
  credentialDeliveryFormSchemaFactory,
  credentialReissueFormSchemaFactory,
} from "./credential-reissue-form-schema";

const messages = {
  reasonRequired: "Choose a reason",
  noteRequired: "Add a note only for the other reason",
  noteTooLong: "Keep the note under 200 characters",
  confirmationRequired: "Confirm the operation",
  channelRequired: "Choose a delivery channel",
};

describe("credential reissue form schema", () => {
  const schema = credentialReissueFormSchemaFactory(messages);

  it("accepts each structured reason without a note", () => {
    for (const reason of [
      "expired_credential",
      "forgotten_password",
      "suspected_compromise",
      "failure_recovery",
    ] as const) {
      expect(schema.safeParse({ reason, reasonNote: "", confirmed: true }).success).toBe(true);
    }
  });

  it("requires a trimmed bounded note only for other", () => {
    expect(schema.safeParse({ reason: "other", reasonNote: "  ", confirmed: true }).success).toBe(false);
    expect(schema.safeParse({ reason: "other", reasonNote: "Manual verification", confirmed: true }).success).toBe(true);
    expect(schema.safeParse({ reason: "other", reasonNote: "x".repeat(201), confirmed: true }).success).toBe(false);
    expect(schema.safeParse({ reason: "forgotten_password", reasonNote: "extra", confirmed: true }).success).toBe(false);
  });

  it("requires explicit confirmation", () => {
    expect(schema.safeParse({ reason: "forgotten_password", reasonNote: "", confirmed: false }).success).toBe(false);
  });

  it("allows only non-sensitive delivery categories", () => {
    const deliverySchema = credentialDeliveryFormSchemaFactory(messages);
    for (const channel of ["in_person", "phone", "secure_message", "other"] as const) {
      expect(deliverySchema.safeParse({ channel }).success).toBe(true);
    }
    expect(deliverySchema.safeParse({ channel: "someone@example.com" }).success).toBe(false);
  });
});
