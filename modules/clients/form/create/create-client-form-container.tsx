"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCreateClient } from "../../lib/hooks/use-create-client";
import type { ClientCreationResult } from "../../lib/types/client.types";
import { createClientSchemaFactory, type CreateClientSchema } from "./schemas/create-client-schema";
import ClientForm from "../client-form";
import ClientCreationPreviewView from "./client-creation-preview";

export default function CreateClientFormContainer({ onClose, onSuccess, onReuse, onLockChange }: {
  onClose: () => void;
  onSuccess: (result: ClientCreationResult) => void;
  onReuse: (id: string) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const t = useTranslations("clientForm.validation");
  const creation = useCreateClient({ onSuccess, onLockChange });
  const form = useForm<CreateClientSchema>({
    resolver: zodResolver(createClientSchemaFactory({
      nameRequired: t("nameRequired"),
      invalidEmail: t("invalidEmail"),
      invalidPhone: t("invalidPhone"),
      contactRequired: t("contactRequired"),
      tooLong: t("tooLong"),
    })),
    defaultValues: { name: "", email: "", phone: "", company: "", address: "", notes: "" },
  });
  return (
    <FormProvider {...form}>
      {creation.preview ? (
        <ClientCreationPreviewView
          preview={creation.preview}
          loading={creation.isLoading}
          error={creation.error}
          uncertain={creation.uncertain}
          expired={creation.expired}
          acknowledged={creation.acknowledged}
          onAcknowledge={creation.acknowledge}
          onConfirm={() => void creation.confirm()}
          onBack={creation.reset}
          onReuse={onReuse}
        />
      ) : (
        <form noValidate onSubmit={form.handleSubmit(creation.prepare)} onChange={creation.reset} className="h-full">
          <ClientForm loading={creation.isLoading} error={creation.error} onCancel={onClose} />
        </form>
      )}
    </FormProvider>
  );
}
