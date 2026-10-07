"use client";

import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createUserSchemaFactory, type CreateUserSchema } from "./schemas/create-user-schema";
import { useCreateUser } from "../../lib/hooks/use-create-user";
import CreateUserForm from "./create-user-form";
import { TemporaryCredentialResult } from "./temporary-credential-result";
import type { ProvisionedTrialUser } from "../../lib/types/user.types";

export default function CreateUserFormContainer({
  onClose,
  onCredentialVisibleChange,
}: {
  onClose?: () => void;
  onCredentialVisibleChange?: (visible: boolean) => void;
}) {
  const router = useRouter();
  const t = useTranslations("users.create");
  const tValidation = useTranslations("userForm.validation");
  const [provisioned, setProvisioned] = useState<ProvisionedTrialUser | null>(null);
  const success = useCallback((result: ProvisionedTrialUser) => {
    toast.success(t("successToast"), { position: "top-right" });
    setProvisioned(result);
    onCredentialVisibleChange?.(true);
  }, [onCredentialVisibleChange, t]);
  const { createUser, isLoading, error } = useCreateUser(success);
  const schema = createUserSchemaFactory({
    nameMin: tValidation("nameMin"),
    invalidEmail: tValidation("invalidEmail"),
    initialCreditAllocation: tValidation("initialCreditAllocation"),
  });
  const form = useForm<CreateUserSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      locale: "en",
      initialCreditAllocation: 10,
    },
  });
  const finish = useCallback(() => {
    onCredentialVisibleChange?.(false);
    onClose?.();
    setTimeout(() => router.refresh(), 300);
  }, [onClose, onCredentialVisibleChange, router]);

  if (provisioned) {
    return <TemporaryCredentialResult result={provisioned} onDone={finish} />;
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(createUser)} className="h-full">
        <CreateUserForm loading={isLoading} error={error} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
