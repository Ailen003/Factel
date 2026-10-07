"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import type { OwnershipTransferView } from "../lib/types/admin-security.types";
import {
  OwnershipTransferStepUpForm,
  type OwnershipTransferAction,
} from "./ownership-transfer-step-up-form";
import {
  ownershipTransferFormSchemaFactory,
  type OwnershipTransferFormSchema,
} from "./schemas/ownership-transfer-form-schema";

export function OwnershipTransferResolutionContainer({
  action,
  transfer,
  loading,
  error,
  completedStatus,
  onSubmit,
  onClose,
}: {
  action: Exclude<OwnershipTransferAction, "initiate">;
  transfer: OwnershipTransferView;
  loading: boolean;
  error: string | null;
  completedStatus: OwnershipTransferView["status"] | null;
  onSubmit: (values: OwnershipTransferFormSchema) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("users.ownershipTransfer");
  const tValidation = useTranslations("users.ownershipTransfer.validation");
  const form = useForm<OwnershipTransferFormSchema>({
    resolver: zodResolver(ownershipTransferFormSchemaFactory({
      confirmationRequired: tValidation("confirmationRequired"),
      passwordRequired: tValidation("passwordRequired"),
      totpInvalid: tValidation("totpInvalid"),
    })),
    defaultValues: { password: "", totpCode: "", confirmed: false },
    shouldUnregister: true,
  });

  if (completedStatus) {
    return (
      <div className="space-y-5 px-6 py-5">
        <AlertComponent
          title={t(`result.${completedStatus}.title` as never)}
          description={t(`result.${completedStatus}.description` as never)}
          variant="default"
        />
        {completedStatus === "accepted" && (
          <p className="text-sm text-muted-foreground">{t("accept.signInAgain")}</p>
        )}
        <div className="flex justify-end"><Button type="button" onClick={onClose}>{t("done")}</Button></div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full" noValidate>
        <OwnershipTransferStepUpForm
          action={action}
          ownerName={transfer.ownerName}
          targetName={transfer.targetName}
          loading={loading}
          error={error}
          onCancel={onClose}
        />
      </form>
    </FormProvider>
  );
}
