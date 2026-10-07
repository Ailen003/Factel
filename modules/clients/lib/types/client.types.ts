import { z } from "zod";
import { createClientSchema, normalizeInternationalPhone, type CreateClientSchema } from "../../form/create/schemas/create-client-schema";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type ClientDetails = Client;
export interface ClientsResponse {
  clients: Client[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
export const clientFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).catch(1),
  limit: z.coerce.number().int().refine((value) => [5, 10, 20, 30].includes(value)).catch(10),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["name", "email", "company", "createdAt"]).catch("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
});
export type ClientFiltersDto = z.infer<typeof clientFiltersSchema>;
export function parseClientFilters(params: Record<string, string | string[] | undefined>): ClientFiltersDto {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  return clientFiltersSchema.parse({ page: first(params.page), limit: first(params.limit),
    search: first(params.search)?.trim().slice(0, 100) || undefined, sortBy: first(params.sortBy), sortOrder: first(params.sortOrder) });
}
export type CreateClientDto = CreateClientSchema;
export const convertCreateClientDto = (values: CreateClientSchema): CreateClientDto => ({
  name: values.name.trim(), email: values.email?.trim().toLowerCase() || undefined,
  phone: values.phone ? normalizeInternationalPhone(values.phone) : undefined,
  company: values.company?.trim() || undefined, address: values.address?.trim() || undefined,
  notes: values.notes?.trim() || undefined,
});
export interface ClientCreationDraft {
  name: string; email: string | null; phone: string | null;
  company: string | null; address: string | null; notes: string | null;
}
export type ClientDuplicateCandidate = Pick<Client, "id" | "name" | "email" | "phone" | "company" | "version">;
export interface ClientCreationPreview {
  planId: string;
  planHash: string;
  expiresAt: string;
  client: ClientCreationDraft;
  duplicates: ClientDuplicateCandidate[];
}
export const confirmClientCreationSchema = z.object({
  planId: z.string().min(1).max(191),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  acknowledgeDuplicates: z.boolean(),
}).strict();
export type ConfirmClientCreationInput = z.infer<typeof confirmClientCreationSchema>;
export interface ClientCreationResult { clientId: string; operationId: string; replayed: boolean }

export type EditClientDto = CreateClientDto;
export const editClientInputSchema = z.object({
  id: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().positive(),
  acknowledgeDuplicates: z.boolean(),
  client: createClientSchema,
}).strict();
export type EditClientInput = z.infer<typeof editClientInputSchema>;

export const deleteClientInputSchema = z.object({
  id: z.string().trim().min(1).max(191),
  expectedVersion: z.number().int().positive(),
}).strict();
export type DeleteClientInput = z.infer<typeof deleteClientInputSchema>;
export interface DeleteClientResult { clientId: string }
