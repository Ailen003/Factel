import { describe, expect, it } from "vitest";
import { conversationFiltersToDto, readConversationFilters } from "./conversation-filter-url";

describe("conversation URL filters", () => {
  it("reads supported filters and keeps server parameter names", () => {
    const filters = readConversationFilters(new URLSearchParams("sourceType=upload&locale=es&status=audio_ready&sortBy=updatedAt&sortOrder=asc"));
    expect(filters).toEqual({ sourceType: "upload", locale: "es", status: "audio_ready", sortBy: "updatedAt", sortOrder: "asc" });
    expect(conversationFiltersToDto(filters)).toMatchObject({ sourceType: "upload", locale: "es", status: "audio_ready" });
  });

  it("falls back safely and omits empty filters", () => {
    const filters = readConversationFilters(new URLSearchParams("sourceType=other&locale=fr&sortBy=name"));
    expect(filters).toEqual({ sourceType: "", locale: "", status: "", sortBy: "createdAt", sortOrder: "desc" });
    expect(conversationFiltersToDto(filters)).toEqual({ sourceType: undefined, locale: undefined, status: undefined, sortBy: "createdAt", sortOrder: "desc" });
  });
});
