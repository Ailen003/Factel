import { z } from "zod";

export function createLoginSchema(messages: {
  invalidEmail: string;
  passwordRequired: string;
}) {
  return z.object({
    email: z.string().trim().email(messages.invalidEmail),
    password: z.string().min(1, messages.passwordRequired),
  });
}

export type LoginSchema = z.infer<ReturnType<typeof createLoginSchema>>;
