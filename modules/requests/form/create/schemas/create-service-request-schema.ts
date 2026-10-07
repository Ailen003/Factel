import { z } from "zod";

export const SERVICE_TYPES = ["installation", "repair", "maintenance", "inspection", "other"] as const;
export const REQUEST_PRIORITIES = ["low", "normal", "high"] as const;
export const REQUEST_STATUSES = ["pending", "in_progress", "resolved", "cancelled"] as const;

export interface ServiceRequestValidationMessages {
  clientRequired: string; titleRequired: string; descriptionRequired: string;
  serviceTypeRequired: string; priorityRequired: string; tooLong: string;
}

export function createServiceRequestSchemaFactory(messages: ServiceRequestValidationMessages) {
  return z.object({
    clientId: z.string().trim().min(1, messages.clientRequired).max(191, messages.tooLong),
    title: z.string().trim().min(1, messages.titleRequired).max(201, messages.tooLong),
    description: z.string().trim().min(1, messages.descriptionRequired).max(4000, messages.tooLong),
    serviceType: z.enum(SERVICE_TYPES, { message: messages.serviceTypeRequired }),
    priority: z.enum(REQUEST_PRIORITIES, { message: messages.priorityRequired }).default("normal"),
    preferredSchedule: z.string().trim().max(1000, messages.tooLong).optional(),
    serviceAddress: z.string().trim().max(1000, messages.tooLong).optional(),
    nextSteps: z.string().trim().max(4000, messages.tooLong).optional(),
  }).strict();
}

export const createServiceRequestSchema = createServiceRequestSchemaFactory({
  clientRequired: "VALIDATION_ERROR", titleRequired: "VALIDATION_ERROR", descriptionRequired: "VALIDATION_ERROR",
  serviceTypeRequired: "VALIDATION_ERROR", priorityRequired: "VALIDATION_ERROR", tooLong: "VALIDATION_ERROR",
});
export type CreateServiceRequestSchema = z.infer<typeof createServiceRequestSchema>;
