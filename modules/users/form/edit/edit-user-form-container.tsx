"use client";

import { useCallback } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { editUserSchemaFactory, type EditUserSchema } from "./schemas/edit-user-schema";
import type { UserDetails } from "../../lib/types/user.types";
import { useEditUser } from "../../lib/hooks/use-edit-user";
import UserForm from "../user-form";

export default function EditUserFormContainer({ user, onClose }: {
  user: UserDetails;
  onClose?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("users.edit");
  const tValidation = useTranslations("userForm.validation");
  const success = useCallback(() => {
    toast.success(t("successToast"), { position: "top-right" });
    onClose?.();
    setTimeout(() => router.refresh(), 300);
  }, [onClose, router, t]);
  const { editUser, isLoading, error } = useEditUser(success);
  const form = useForm<EditUserSchema>({
    resolver: zodResolver(editUserSchemaFactory(tValidation("nameMin"))),
    defaultValues: { name: user.fullName, locale: user.locale },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit((values) => editUser(user.id, values))} className="h-full">
        <UserForm user={user} loading={isLoading} error={error} onCancel={onClose} />
      </form>
    </FormProvider>
  );
}
