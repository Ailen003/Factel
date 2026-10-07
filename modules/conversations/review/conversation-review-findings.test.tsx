import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import ConversationReviewFindings from "./conversation-review-findings";

describe("contact human-review findings", () => {
  it.each([["en", en], ["es", es]] as const)("identifies the affected request and allows resolving discarded evidence in %s", (locale, messages) => {
    const onResolution = vi.fn();
    render(<NextIntlClientProvider locale={locale} messages={messages}>
      <ConversationReviewFindings findings={[{ id: "invalid-service", code: "NONEXISTENT_EVIDENCE", target: "request", itemId: "item-2",
        fieldKey: "serviceType", severity: "blocking", resolution: null }]}
        requestItems={[{ stableItemId: "item-1" }, { stableItemId: "item-2" }]} resolutions={{}} onResolution={onResolution} />
    </NextIntlClientProvider>);
    expect(screen.getByText(messages.conversationReview.findingCodes.NONEXISTENT_EVIDENCE)).toBeTruthy();
    expect(screen.getByText(messages.conversationReview.requestNumber.replace("{number}", "2"))).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Reviewed the transcript" } });
    expect(onResolution).toHaveBeenCalledWith("invalid-service", "Reviewed the transcript");
  });
  it.each([["en", en], ["es", es]] as const)("explains phone and email uncertainty and allows a decision in %s", (locale, messages) => {
    const onResolution = vi.fn();
    render(<NextIntlClientProvider locale={locale} messages={messages}>
      <ConversationReviewFindings findings={["phone", "email"].map((fieldKey) => ({ id: fieldKey, code: "AMBIGUITY", target: "client", itemId: null,
        fieldKey: fieldKey as "phone" | "email", severity: "blocking", resolution: null }))}
        resolutions={{}} onResolution={onResolution} />
    </NextIntlClientProvider>);
    expect(screen.getByText(messages.conversationReview.contactReview.phone)).toBeTruthy();
    expect(screen.getByText(messages.conversationReview.contactReview.email)).toBeTruthy();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Confirmed with the caller" } });
    expect(onResolution).toHaveBeenCalledWith("phone", "Confirmed with the caller");
  });
});
