import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import messages from "@/messages/en.json";
import CreateUserForm from "./create/create-user-form";
import UserForm from "./user-form";
import LoginForm from "@/modules/login/form/login-form";
import { editUserSchema } from "./edit/schemas/edit-user-schema";

function CreateHarness() {
  const form = useForm({ defaultValues: { name: "", email: "", locale: "en", initialCreditAllocation: 10 } });
  return <NextIntlClientProvider locale="en" messages={messages}><FormProvider {...form}><CreateUserForm loading={false} error={null} onCancel={vi.fn()} /></FormProvider></NextIntlClientProvider>;
}

function EditHarness() {
  const form = useForm({ defaultValues: { name: "Demo Administrator", locale: "en" } });
  return <NextIntlClientProvider locale="en" messages={messages}><FormProvider {...form}><UserForm user={{ id: "admin", email: "admin@example.com", fullName: "Demo Administrator", role: "platform_admin", adminProfile: "owner", adminProfileVersion: 1, twoFactorEnabled: true, twoFactorVerified: true, status: "active", locale: "en", initialCreditAllocation: 10, temporaryPasswordChangeRequired: false, temporaryPasswordExpiresAt: null, temporaryPasswordPurpose: null, temporaryCredentialVersion: 0, latestTemporaryCredentialIssuance: null, trialActivatedAt: null, trialExpiresAt: null, createdAt: "2026-09-06T00:00:00Z", updatedAt: "2026-09-06T00:00:00Z" }} loading={false} error={null} onCancel={vi.fn()} /></FormProvider></NextIntlClientProvider>;
}

function LoginHarness() {
  const form = useForm({ defaultValues: { email: "", password: "" } });
  return <NextIntlClientProvider locale="en" messages={messages}><FormProvider {...form}><LoginForm loading={false} error={null} /></FormProvider></NextIntlClientProvider>;
}

describe("user administration forms", () => {
  it("creates only a trial account shape without exposing a role field", () => {
    render(<CreateHarness />);
    expect(screen.getByRole("textbox", { name: "Full Name" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Preferred language" })).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Initial credit allocation" })).toBeTruthy();
    expect(screen.getByText(/secure temporary password/i)).toBeTruthy();
    expect(screen.queryByLabelText("Temporary password")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
  });

  it("keeps the owner profile read-only while allowing name and locale edits", () => {
    render(<EditHarness />);
    expect((screen.getByRole("textbox", { name: "Full Name" }) as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByRole("combobox", { name: "Role" })).toBeNull();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Preferred language" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/separate owner-only actions/i)).toBeTruthy();
  });

  it("keeps role out of the generic edit schema", () => {
    expect("role" in editUserSchema.shape).toBe(false);
    expect(editUserSchema.parse({ name: "Updated Name", locale: "es", role: "trial_user" })).toEqual({
      name: "Updated Name",
      locale: "es",
    });
  });

  it("does not advertise registration or password recovery", () => {
    render(<LoginHarness />);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeTruthy();
    expect(screen.queryByText("Forgot password?")).toBeNull();
    expect(screen.queryByText("Sign Up")).toBeNull();
  });
});
