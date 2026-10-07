import { z } from "zod";

export function editUserSchemaFactory(nameMin: string) {
  return z.object({
    name: z.string().trim().min(2, nameMin).max(201),
    locale: z.enum(["en", "es"]),
  });
}

export const editUserSchema = editUserSchemaFactory(
  "Name must contain at least 2 characters",
);
export type EditUserSchema = z.infer<typeof editUserSchema>;
