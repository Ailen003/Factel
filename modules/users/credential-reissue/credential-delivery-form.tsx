"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { TemporaryCredentialDeliveryChannel } from "../lib/types/temporary-credential-reissue.types";
import {
  credentialDeliveryFormSchemaFactory,
  type CredentialDeliveryFormSchema,
} from "./schemas/credential-reissue-form-schema";

export function CredentialDeliveryForm({
  loading,
  error,
  onConfirm,
}: {
  loading: boolean;
  error: string | null;
  onConfirm: (channel: TemporaryCredentialDeliveryChannel) => Promise<void>;
}) {
  const t = useTranslations("users.credentialReissue");
  const tValidation = useTranslations("users.credentialReissue.validation");
  const channels = (["in_person", "phone", "secure_message", "other"] as const)
    .map((value) => ({ value, label: t(`channels.${value}`) }));
  const form = useForm<CredentialDeliveryFormSchema>({
    resolver: zodResolver(credentialDeliveryFormSchemaFactory({
      reasonRequired: tValidation("reasonRequired"),
      noteRequired: tValidation("noteRequired"),
      noteTooLong: tValidation("noteTooLong"),
      confirmationRequired: tValidation("confirmationRequired"),
      channelRequired: tValidation("channelRequired"),
    })),
    defaultValues: { channel: "secure_message" },
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((values) => onConfirm(values.channel))}
        className="space-y-4 rounded-md border p-4"
        noValidate
      >
        {error && <AlertComponent title={error} variant="destructive" />}
        <div>
          <p className="font-medium">{t("deliveryTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("deliveryDescription")}</p>
        </div>
        <RHFSelectField
          name="channel"
          label={t("deliveryChannelLabel")}
          options={channels}
          fullWidth
        />
        <p className="text-xs text-muted-foreground">{t("deliveryPrivacyNotice")}</p>
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t("confirmingDelivery")}</>
          ) : t("confirmDelivery")}
        </Button>
      </form>
    </FormProvider>
  );
}
