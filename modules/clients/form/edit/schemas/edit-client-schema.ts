import { createClientSchemaFactory } from "../../create/schemas/create-client-schema";
import { z } from "zod";

export const editClientSchemaFactory = createClientSchemaFactory;
export type EditClientSchema = z.infer<ReturnType<typeof editClientSchemaFactory>>;
