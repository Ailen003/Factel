"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  createAccessRequestSchemaFactory,
  type CreateAccessRequestSchema,
} from "./schemas/create-access-request-schema";
import { usePrepareAccessRequest } from "../../lib/hooks/use-prepare-access-request";
import { AccessRequestForm } from "../access-request-form";

export function CreateAccessRequestFormContainer() {
  const t = useTranslations("accessRequestForm.validation");
  const { prepare, isLoading, error, preparedEmail } = usePrepareAccessRequest();
  const form = useForm<CreateAccessRequestSchema>({
    resolver: zodResolver(
      createAccessRequestSchemaFactory({
        nameRequired: t("nameRequired"),
        invalidEmail: t("invalidEmail"),
        messageRequired: t("messageRequired"),
        messageTooShort: t("messageTooShort"),
        tooLong: t("tooLong"),
      }),
    ),
    defaultValues: {
      fullName: "",
      email: "",
      organization: "",
      message: "",
    },
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(prepare)} noValidate>
        <AccessRequestForm
          loading={isLoading}
          error={error}
          preparedEmail={preparedEmail}
        />
      </form>
    </FormProvider>
  );
}
