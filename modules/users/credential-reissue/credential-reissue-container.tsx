"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { useTemporaryCredentialReissue } from "../lib/hooks/use-temporary-credential-reissue";
import type { User } from "../lib/types/user.types";
import { CredentialReissueForm } from "./credential-reissue-form";
import { CredentialReissueResult } from "./credential-reissue-result";
import {
  credentialReissueFormSchemaFactory,
  type CredentialReissueFormSchema,
} from "./schemas/credential-reissue-form-schema";

export function CredentialReissueContainer({
  user,
  operationId,
  onClose,
  onBusyChange,
}: {
  user: User;
  operationId: string;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const tValidation = useTranslations("users.credentialReissue.validation");
  const { reissue, confirmDelivery, isLoading, error, result, reset } =
    useTemporaryCredentialReissue();
  const form = useForm<CredentialReissueFormSchema>({
    resolver: zodResolver(credentialReissueFormSchemaFactory({
      reasonRequired: tValidation("reasonRequired"),
      noteRequired: tValidation("noteRequired"),
      noteTooLong: tValidation("noteTooLong"),
      confirmationRequired: tValidation("confirmationRequired"),
      channelRequired: tValidation("channelRequired"),
    })),
    defaultValues: {
      reason: user.trialActivatedAt === null ? "expired_credential" : "forgotten_password",
      reasonNote: "",
      confirmed: false,
    },
    shouldUnregister: true,
  });

  useEffect(() => {
    onBusyChange?.(isLoading);
  }, [isLoading, onBusyChange]);

  useEffect(() => () => {
    reset();
    onBusyChange?.(false);
  }, [onBusyChange, reset]);

  async function submit(values: CredentialReissueFormSchema) {
    await reissue({
      targetUserId: user.id,
      operationId,
      expectedVersion: user.temporaryCredentialVersion,
      reason: values.reason,
      reasonNote: values.reason === "other" ? values.reasonNote?.trim() : undefined,
      confirmed: true,
    });
  }

  if (result) {
    return (
      <CredentialReissueResult
        email={user.email}
        result={result}
        loading={isLoading}
        error={error}
        onConfirmDelivery={confirmDelivery}
        onDone={onClose}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="h-full" noValidate>
        <CredentialReissueForm
          user={user}
          loading={isLoading}
          error={error}
          onCancel={onClose}
        />
      </form>
    </FormProvider>
  );
}
