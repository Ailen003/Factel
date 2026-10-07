import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { TemporaryPasswordForm } from "./temporary-password-form";

function Harness({ locale }: { locale: "en" | "es" }) {
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const messages = locale === "en" ? en : es;
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <FormProvider {...form}>
        <TemporaryPasswordForm loading={false} error={null} onSignOut={vi.fn()} />
      </FormProvider>
    </NextIntlClientProvider>
  );
}

afterEach(cleanup);

describe("temporary-password form localization and accessibility", () => {
  it.each([
    ["en", "Temporary password", "New password", "Confirm new password", "Change password and continue"],
    ["es", "Contraseña temporal", "Nueva contraseña", "Confirma la nueva contraseña", "Cambiar contraseña y continuar"],
  ] as const)("exposes equivalent labeled controls in %s", (locale, current, next, confirm, submit) => {
    render(<Harness locale={locale} />);
    expect(screen.getByLabelText(current)).toBeTruthy();
    expect(screen.getByLabelText(next)).toBeTruthy();
    expect(screen.getByLabelText(confirm)).toBeTruthy();
    expect(screen.getByRole("button", { name: submit })).toBeTruthy();
  });
});
