"use server";

import { z } from "zod";
import { createClientSchema } from "../../form/create/schemas/create-client-schema";
import { clientFiltersSchema, confirmClientCreationSchema, deleteClientInputSchema, editClientInputSchema } from "../types/client.types";
import { deleteClient, editClient, getAllClients, getClientById } from "../services/client.services";
import { prepareClientCreation, confirmClientCreation } from "@/lib/records/record-plan.services";

const invalid = () => ({ success: false as const, error: { code: "VALIDATION_ERROR", message: "VALIDATION_ERROR" } });

export async function getAllClientsAction(filters: unknown) {
  const parsed = clientFiltersSchema.safeParse(filters);
  return parsed.success ? getAllClients(parsed.data) : invalid();
}
export async function getClientByIdAction(id: unknown) {
  const parsed = z.string().trim().min(1).max(191).safeParse(id);
  return parsed.success ? getClientById(parsed.data) : invalid();
}
export async function prepareClientCreationAction(dto: unknown) {
  const parsed = createClientSchema.safeParse(dto);
  return parsed.success ? prepareClientCreation(parsed.data) : invalid();
}
export async function confirmClientCreationAction(input: unknown) {
  const parsed = confirmClientCreationSchema.safeParse(input);
  return parsed.success ? confirmClientCreation(parsed.data) : invalid();
}
export async function editClientAction(input: unknown) {
  const parsed = editClientInputSchema.safeParse(input);
  return parsed.success ? editClient(parsed.data) : invalid();
}
export async function deleteClientAction(input: unknown) {
  const parsed = deleteClientInputSchema.safeParse(input);
  return parsed.success ? deleteClient(parsed.data) : invalid();
}
