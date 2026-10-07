"use client";

import { useCallback } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import ClientForm from "../client-form";
import type { ClientDetails } from "../../lib/types/client.types";
import { useEditClient } from "../../lib/hooks/use-edit-client";
import { editClientSchemaFactory, type EditClientSchema } from "./schemas/edit-client-schema";

export default function EditClientFormContainer({ client, onClose }: { client: ClientDetails; onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations("clients.edit");
  const validation = useTranslations("clientForm.validation");
  const success = useCallback(() => { toast.success(t("success"), { position: "top-right" }); onClose();
    setTimeout(() => router.refresh(), 300); }, [onClose, router, t]);
  const mutation = useEditClient(success);
  const form = useForm<EditClientSchema>({ resolver: zodResolver(editClientSchemaFactory({
    nameRequired: validation("nameRequired"), invalidEmail: validation("invalidEmail"),
    invalidPhone: validation("invalidPhone"), contactRequired: validation("contactRequired"), tooLong: validation("tooLong"),
  })), defaultValues: { name: client.name, email: client.email ?? "", phone: client.phone ?? "",
    company: client.company ?? "", address: client.address ?? "", notes: client.notes ?? "" } });
  return <FormProvider {...form}><form noValidate onSubmit={form.handleSubmit((values) => mutation.save(client.id, client.version, values))}
    className="h-full">
    <ClientForm mode="edit" loading={mutation.isLoading} error={mutation.error} onCancel={onClose}
      duplicates={mutation.duplicates} acknowledged={mutation.acknowledged} onAcknowledge={mutation.acknowledge}
      onValuesChange={mutation.resetDuplicates} />
  </form></FormProvider>;
}
