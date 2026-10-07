"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormProvider, useForm } from "react-hook-form";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { useAdminSecurity } from "../lib/hooks/use-admin-security";
import type { User } from "../lib/types/user.types";
import { OperatorMfaRecoveryForm } from "./operator-mfa-recovery-form";
import {
  operatorMfaRecoveryFormSchemaFactory,
  type OperatorMfaRecoveryFormSchema,
} from "./schemas/operator-mfa-recovery-form-schema";

export function OperatorMfaRecoveryContainer({
  user,
  operationId,
  onClose,
  onBusyChange,
  onCompleted,
}: {
  user: User;
  operationId: string;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  onCompleted?: () => void;
}) {
  const t = useTranslations("users.mfaRecovery");
  const tValidation = useTranslations("users.mfaRecovery.validation");
  const { recoverOperator, isLoading, error, recoveryResult, reset } = useAdminSecurity();
  const [currentOperationId, setCurrentOperationId] = useState(operationId);
  const form = useForm<OperatorMfaRecoveryFormSchema>({
    resolver: zodResolver(operatorMfaRecoveryFormSchemaFactory({
      confirmationRequired: tValidation("confirmationRequired"),
      passwordRequired: tValidation("passwordRequired"),
      reasonRequired: tValidation("reasonRequired"),
      referenceInvalid: tValidation("referenceInvalid"),
      referenceTooLong: tValidation("referenceTooLong"),
      totpInvalid: tValidation("totpInvalid"),
    })),
    defaultValues: {
      reason: "lost_all_factors",
      operationalReference: "",
      password: "",
      totpCode: "",
      confirmed: false,
    },
    shouldUnregister: true,
  });

  useEffect(() => onBusyChange?.(isLoading), [isLoading, onBusyChange]);
  useEffect(() => () => {
    reset();
    onBusyChange?.(false);
  }, [onBusyChange, reset]);
  useEffect(() => {
    if (recoveryResult) onCompleted?.();
  }, [onCompleted, recoveryResult]);

  async function submit(values: OperatorMfaRecoveryFormSchema) {
    const succeeded = await recoverOperator({
      operationId: currentOperationId,
      targetUserId: user.id,
      expectedAdminProfileVersion: user.adminProfileVersion,
      reason: values.reason,
      operationalReference: values.operationalReference || undefined,
      password: values.password,
      totpCode: values.totpCode,
      confirmed: true,
    });
    if (!succeeded) {
      setCurrentOperationId(crypto.randomUUID());
      form.resetField("password");
      form.resetField("totpCode");
    }
  }

  if (recoveryResult) {
    return (
      <div className="space-y-5 px-6 py-5">
        <AlertComponent
          title={t("successTitle")}
          description={t("successDescription", { count: recoveryResult.revokedSessions })}
          variant="default"
        />
        <p className="text-sm text-muted-foreground">{t("successEnrollment")}</p>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>{t("done")}</Button>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="h-full" noValidate>
        <OperatorMfaRecoveryForm
          user={user}
          loading={isLoading}
          error={error}
          onCancel={onClose}
        />
      </form>
    </FormProvider>
  );
}
