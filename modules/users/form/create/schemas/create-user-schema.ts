import { z } from "zod";

export interface CreateUserValidationMessages {
  nameMin: string;
  invalidEmail: string;
  initialCreditAllocation: string;
}

export function createUserSchemaFactory(messages: CreateUserValidationMessages) {
  return z.object({
    name: z.string().trim().min(2, messages.nameMin).max(201),
    email: z.string().trim().toLowerCase().email(messages.invalidEmail).max(320),
    locale: z.enum(["en", "es"]),
    initialCreditAllocation: z.coerce
      .number()
      .int(messages.initialCreditAllocation)
      .min(0, messages.initialCreditAllocation)
      .max(2147483647, messages.initialCreditAllocation),
  });
}

export const createUserSchema = createUserSchemaFactory({
  nameMin: "Name must contain at least 2 characters",
  invalidEmail: "Invalid email address",
  initialCreditAllocation: "Initial credit allocation must be a nonnegative integer",
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;
