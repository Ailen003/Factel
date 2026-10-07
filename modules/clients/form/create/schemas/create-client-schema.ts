import { z } from "zod";

export interface CreateClientValidationMessages {
  nameRequired: string;
  invalidEmail: string;
  invalidPhone: string;
  contactRequired: string;
  tooLong: string;
}

export function normalizeInternationalPhone(value: string): string {
  return value.trim().replace(/[\s().-]/g, "");
}

export function createClientSchemaFactory(messages: CreateClientValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(201, messages.tooLong),
    email: z.string().trim().toLowerCase().max(320, messages.tooLong).optional(),
    phone: z.string().trim().max(64, messages.tooLong).optional(),
    company: z.string().trim().max(201, messages.tooLong).optional(),
    address: z.string().trim().max(1000, messages.tooLong).optional(),
    notes: z.string().trim().max(4000, messages.tooLong).optional(),
  }).strict().superRefine((values, context) => {
    if (!values.email && !values.phone) {
      context.addIssue({ code: "custom", path: ["email"], message: messages.contactRequired });
    }
    if (values.email && !z.string().email().safeParse(values.email).success) {
      context.addIssue({ code: "custom", path: ["email"], message: messages.invalidEmail });
    }
    if (values.phone && !/^\+[1-9]\d{7,14}$/.test(normalizeInternationalPhone(values.phone))) {
      context.addIssue({ code: "custom", path: ["phone"], message: messages.invalidPhone });
    }
  });
}

export const createClientSchema = createClientSchemaFactory({
  nameRequired: "VALIDATION_ERROR", invalidEmail: "VALIDATION_ERROR",
  invalidPhone: "VALIDATION_ERROR", contactRequired: "VALIDATION_ERROR", tooLong: "VALIDATION_ERROR",
});
export type CreateClientSchema = z.infer<typeof createClientSchema>;
