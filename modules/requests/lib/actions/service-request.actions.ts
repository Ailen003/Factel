"use server";

import { createServiceRequestSchema } from "../../form/create/schemas/create-service-request-schema";
import {
  changeServiceRequestStatusInputSchema, clientCatalogQuerySchema, clientServiceRequestsInputSchema,
  confirmServiceRequestCreationSchema, deleteServiceRequestInputSchema, editServiceRequestInputSchema,
  serviceRequestFiltersSchema, serviceRequestIdSchema,
} from "../types/service-request.types";
import {
  changeServiceRequestStatus, deleteServiceRequest, editServiceRequest,
  getAllServiceRequests, getClientCatalog, getClientServiceRequests, getServiceRequestById,
} from "../services/service-request.services";
import { confirmServiceRequestCreation, prepareServiceRequestCreation } from "@/lib/records/service-request-plan.services";

const invalid = () => ({ success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } });

export async function getAllServiceRequestsAction(filters: unknown) {
  const parsed = serviceRequestFiltersSchema.safeParse(filters);
  return parsed.success ? getAllServiceRequests(parsed.data) : invalid();
}
export async function getClientServiceRequestsAction(filters: unknown) {
  const parsed = clientServiceRequestsInputSchema.safeParse(filters);
  return parsed.success ? getClientServiceRequests(parsed.data) : invalid();
}
export async function getServiceRequestByIdAction(id: unknown) {
  const parsed = serviceRequestIdSchema.safeParse(id);
  return parsed.success ? getServiceRequestById(parsed.data) : invalid();
}
export async function getClientCatalogAction(query: unknown) {
  const parsed = clientCatalogQuerySchema.safeParse(query);
  return parsed.success ? getClientCatalog(parsed.data) : invalid();
}
export async function prepareServiceRequestCreationAction(dto: unknown) {
  const parsed = createServiceRequestSchema.safeParse(dto);
  return parsed.success ? prepareServiceRequestCreation(parsed.data) : invalid();
}
export async function confirmServiceRequestCreationAction(input: unknown) {
  const parsed = confirmServiceRequestCreationSchema.safeParse(input);
  return parsed.success ? confirmServiceRequestCreation(parsed.data) : invalid();
}
export async function editServiceRequestAction(input: unknown) {
  const parsed = editServiceRequestInputSchema.safeParse(input);
  return parsed.success ? editServiceRequest(parsed.data) : invalid();
}
export async function changeServiceRequestStatusAction(input: unknown) {
  const parsed = changeServiceRequestStatusInputSchema.safeParse(input);
  return parsed.success ? changeServiceRequestStatus(parsed.data) : invalid();
}
export async function deleteServiceRequestAction(input: unknown) {
  const parsed = deleteServiceRequestInputSchema.safeParse(input);
  return parsed.success ? deleteServiceRequest(parsed.data) : invalid();
}
