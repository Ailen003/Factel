import { z } from "zod";
import {
  REQUEST_PRIORITIES,
  SERVICE_TYPES,
  type ServiceRequestValidationMessages,
} from "../../create/schemas/create-service-request-schema";

export function editServiceRequestSchemaFactory(messages: ServiceRequestValidationMessages) {
  return z.object({
    clientId: z.string().trim().min(1, messages.clientRequired).max(191, messages.tooLong),
    title: z.string().trim().min(1, messages.titleRequired).max(201, messages.tooLong),
    description: z.string().trim().min(1, messages.descriptionRequired).max(4000, messages.tooLong),
    serviceType: z.enum(SERVICE_TYPES, { message: messages.serviceTypeRequired }),
    priority: z.enum(REQUEST_PRIORITIES, { message: messages.priorityRequired }),
    preferredSchedule: z.string().trim().max(1000, messages.tooLong).optional(),
    serviceAddress: z.string().trim().max(1000, messages.tooLong).optional(),
    nextSteps: z.string().trim().max(4000, messages.tooLong).optional(),
  }).strict();
}

export const editServiceRequestSchema = editServiceRequestSchemaFactory({
  clientRequired: "VALIDATION_ERROR",
  titleRequired: "VALIDATION_ERROR",
  descriptionRequired: "VALIDATION_ERROR",
  serviceTypeRequired: "VALIDATION_ERROR",
  priorityRequired: "VALIDATION_ERROR",
  tooLong: "VALIDATION_ERROR",
});

export type EditServiceRequestSchema = z.infer<typeof editServiceRequestSchema>;
