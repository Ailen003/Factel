"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { editWidgetSchema, EditWidgetSchema } from "./schemas/edit-widget-schema";
import WidgetForm from "../widget-form";
import { WidgetDetails } from "../../lib/types/widget.types";
import { useEditWidget } from "../../lib/hooks/use-edit-widget";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface Props {
  widget: WidgetDetails;
  onClose?: () => void;
}

export default function EditWidgetFormContainer({ widget, onClose }: Props) {
  const router = useRouter();
  const t = useTranslations("widgetForm");
  const schema = editWidgetSchema({
    nameRequired: t("validation.nameRequired"),
    nameTooLong: t("validation.nameTooLong"),
    descriptionTooLong: t("validation.descriptionTooLong"),
    typeInvalid: t("validation.typeInvalid"),
  });

  const { editWidget, isLoading, error } = useEditWidget({
    onSuccess: () => {
      toast.success(t("editSuccess"), { position: "top-right" });
      onClose?.();
      setTimeout(() => { router.refresh(); }, 300);
    },
  });

  const form = useForm<EditWidgetSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: widget.name,
      description: widget.description || "",
      isActive: widget.isActive,
      type: widget.type,
    },
  });

  function onSubmit(data: EditWidgetSchema) {
    void editWidget(widget.id, data);
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <WidgetForm loading={isLoading} error={error} onCancel={() => onClose?.()} isEditMode />
      </form>
    </FormProvider>
  );
}
