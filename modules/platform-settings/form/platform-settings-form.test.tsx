import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import type { PlatformSettings } from "../lib/types/platform-settings.types";
import {
  PlatformAdmissionControl,
  PlatformSettingsFormContainer,
} from "./platform-settings-form-container";

const testState = vi.hoisted(() => ({
  updateContact: vi.fn(),
  setAdmission: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../lib/hooks/use-update-platform-settings", () => ({
  useUpdatePlatformContactEmail: () => ({
    updateContact: testState.updateContact,
    isLoading: false,
    error: null,
    reset: vi.fn(),
  }),
  useSetPlatformAdmission: () => ({
    setAdmission: testState.setAdmission,
    isLoading: false,
    error: null,
    reset: vi.fn(),
  }),
}));

const ownerSettings: PlatformSettings = {
  accessContactEmail: "access@example.com",
  accessRequestsEnabled: true,
  version: 3,
  configured: true,
  updatedAt: "2026-09-10T12:00:00.000Z",
  canUpdateContact: true,
  canPause: true,
  canResume: true,
};

function renderControls(settings: PlatformSettings) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PlatformSettingsFormContainer settings={settings} />
      <PlatformAdmissionControl settings={settings} />
    </NextIntlClientProvider>,
  );
}

describe("platform settings controls", () => {
  beforeEach(() => {
    testState.updateContact.mockClear();
    testState.setAdmission.mockClear();
  });

  it("shows the owner contact form and pause control while admission is enabled", () => {
    renderControls(ownerSettings);

    expect(screen.getByRole("textbox", { name: "Access contact email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save contact email" })).toBeTruthy();
    expect(screen.getByText("Accepting requests")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause access requests" }));
    expect(testState.setAdmission).toHaveBeenCalledWith(false, 3);
    expect(screen.queryByRole("button", { name: "Resume access requests" })).toBeNull();
  });

  it("shows operators read-only contact details and the same responsive pause action", () => {
    renderControls({
      ...ownerSettings,
      canUpdateContact: false,
      canResume: false,
    });

    expect(screen.queryByRole("textbox", { name: "Access contact email" })).toBeNull();
    expect(screen.getByText("access@example.com")).toBeTruthy();
    expect(screen.getByText("Only the owner can change the contact email.")).toBeTruthy();
    const pause = screen.getByRole("button", { name: "Pause access requests" });
    expect(pause.className).toContain("w-full");
    expect(pause.className).toContain("sm:w-auto");
  });

  it("hides resume from an operator when admission is paused and explains why", () => {
    renderControls({
      ...ownerSettings,
      accessRequestsEnabled: false,
      canUpdateContact: false,
      canPause: true,
      canResume: false,
    });

    expect(screen.getByText("Requests paused")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause access requests" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resume access requests" })).toBeNull();
    expect(screen.getByText("Access requests are paused. Only the owner can resume them.")).toBeTruthy();
  });

  it("allows only the owner to resume paused admission", () => {
    renderControls({
      ...ownerSettings,
      accessRequestsEnabled: false,
      canPause: true,
      canResume: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Resume access requests" }));
    expect(testState.setAdmission).toHaveBeenCalledWith(true, 3);
    expect(screen.queryByText(/Only the owner can resume them/i)).toBeNull();
  });
});
