import { z } from "zod";

export interface PlatformSettingsValidationMessages {
  invalidEmail: string;
}

export function platformSettingsSchemaFactory(
  messages: PlatformSettingsValidationMessages,
) {
  return z.object({
    accessContactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email(messages.invalidEmail)
      .max(320, messages.invalidEmail),
  });
}

export const platformSettingsSchema = platformSettingsSchemaFactory({
  invalidEmail: "Invalid contact email",
});

export type PlatformSettingsSchema = z.infer<typeof platformSettingsSchema>;
