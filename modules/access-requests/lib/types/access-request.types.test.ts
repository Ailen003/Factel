import { describe, expect, it } from "vitest";
import { buildAccessRequestMailto } from "./access-request.types";

describe("access request mailto builder", () => {
  it("encodes a structured message without executable query injection", () => {
    const mailto = buildAccessRequestMailto(
      "demo@example.com",
      {
        fullName: "Alex & Sam",
        email: "alex@example.com",
        organization: "R&D",
        message: "We want to evaluate audio intake & review.",
      },
      {
        subject: "Demo access request",
        nameLabel: "Name",
        emailLabel: "Email",
        organizationLabel: "Organization",
        messageLabel: "Message",
        notProvided: "Not provided",
      },
    );

    expect(mailto.startsWith("mailto:demo%40example.com?")).toBe(true);
    const query = new URLSearchParams(mailto.split("?")[1]);
    expect(query.get("subject")).toBe("Demo access request");
    expect(query.get("body")).toContain("Name: Alex & Sam");
    expect(query.get("body")).toContain("R&D");
  });
});
