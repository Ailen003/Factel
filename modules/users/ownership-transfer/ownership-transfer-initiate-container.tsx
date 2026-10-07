"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { DetailsContainerWrapper } from "@/components/details-container-wrapper/details-container-wrapper";
import { useAdminSecurity } from "../lib/hooks/use-admin-security";
import { useUser } from "../lib/hooks/use-user";
import type { User } from "../lib/types/user.types";
import { OwnershipTransferStepUpForm } from "./ownership-transfer-step-up-form";
import {
  ownershipTransferFormSchemaFactory,
  type OwnershipTransferFormSchema,
} from "./schemas/ownership-transfer-form-schema";

export function OwnershipTransferInitiateContainer({
  currentUserId,
  target,
  operationId,
  onClose,
  onBusyChange,
  onCompleted,
}: {
  currentUserId: string;
  target: User;
  operationId: string;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  onCompleted?: () => void;
}) {
  const t = useTranslations("users.ownershipTransfer");
  const tValidation = useTranslations("users.ownershipTransfer.validation");
  const ownerState = useUser({ userId: currentUserId });
  const { initiateTransfer, isLoading, error, transferResult, reset } = useAdminSecurity();
  const [currentOperationId, setCurrentOperationId] = useState(operationId);
  const form = useForm<OwnershipTransferFormSchema>({
    resolver: zodResolver(ownershipTransferFormSchemaFactory({
      confirmationRequired: tValidation("confirmationRequired"),
      passwordRequired: tValidation("passwordRequired"),
      totpInvalid: tValidation("totpInvalid"),
    })),
    defaultValues: { password: "", totpCode: "", confirmed: false },
    shouldUnregister: true,
  });

  const busy = isLoading || ownerState.isLoading;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => {
    reset();
    onBusyChange?.(false);
  }, [onBusyChange, reset]);
  useEffect(() => {
    if (transferResult) onCompleted?.();
  }, [onCompleted, transferResult]);

  if (transferResult) {
    return (
      <div className="space-y-5 px-6 py-5">
        <AlertComponent
          title={t("initiate.successTitle")}
          description={t("initiate.successDescription", { target: transferResult.transfer.targetName })}
          variant="default"
        />
        <p className="text-sm text-muted-foreground">
          {t("expiresAt", { date: new Date(transferResult.transfer.expiresAt).toLocaleString() })}
        </p>
        <div className="flex justify-end"><Button type="button" onClick={onClose}>{t("done")}</Button></div>
      </div>
    );
  }

  return (
    <DetailsContainerWrapper
      data={ownerState.user}
      isLoading={ownerState.isLoading}
      error={ownerState.error}
      entityKey="user"
      containerClassName="flex min-h-64 items-center justify-center"
    >
      {(owner) => (
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const succeeded = await initiateTransfer({
                operationId: currentOperationId,
                targetUserId: target.id,
                expectedOwnerVersion: owner.adminProfileVersion,
                expectedTargetVersion: target.adminProfileVersion,
                password: values.password,
                totpCode: values.totpCode,
                confirmed: true,
              });
              if (!succeeded) {
                setCurrentOperationId(crypto.randomUUID());
                form.resetField("password");
                form.resetField("totpCode");
              }
            })}
            className="h-full"
            noValidate
          >
            <OwnershipTransferStepUpForm
              action="initiate"
              ownerName={owner.fullName}
              targetName={target.fullName}
              loading={isLoading}
              error={error}
              onCancel={onClose}
            />
          </form>
        </FormProvider>
      )}
    </DetailsContainerWrapper>
  );
}
