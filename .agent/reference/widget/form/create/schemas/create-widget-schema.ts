import { z } from "zod";

export interface CreateWidgetValidationMessages {
  nameRequired: string;
  nameTooLong: string;
  descriptionTooLong: string;
  typeInvalid: string;
}

export const createWidgetSchema = (messages: CreateWidgetValidationMessages) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(120, messages.nameTooLong),
    description: z
      .string()
      .trim()
      .max(1_000, messages.descriptionTooLong)
      .optional(),
    isActive: z.boolean().default(true),
    type: z.enum(["type_a", "type_b"], {
      required_error: messages.typeInvalid,
      invalid_type_error: messages.typeInvalid,
    }),
  });

export type CreateWidgetSchema = z.infer<ReturnType<typeof createWidgetSchema>>;
