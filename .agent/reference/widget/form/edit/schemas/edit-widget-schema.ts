import { z } from "zod";

export interface EditWidgetValidationMessages {
  nameRequired: string;
  nameTooLong: string;
  descriptionTooLong: string;
  typeInvalid: string;
}

export const editWidgetSchema = (messages: EditWidgetValidationMessages) =>
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
    isActive: z.boolean(),
    type: z.enum(["type_a", "type_b"], {
      required_error: messages.typeInvalid,
      invalid_type_error: messages.typeInvalid,
    }),
  });

export type EditWidgetSchema = z.infer<ReturnType<typeof editWidgetSchema>>;
