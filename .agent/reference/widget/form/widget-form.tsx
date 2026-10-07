"use client";

import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import { RHFToggleField } from "@/components/form/rhf-components/rhf-toggle-field/rhf-toggle-field";
import { RHFSelectField } from "@/components/form/rhf-components/rhf-select-field/rhf-select-field";
import { AlertComponent } from "@/components/ui/alert-component";
import { useTranslations } from "next-intl";
import FormActionFooter from "@/components/form/components/form-action-footer";

interface WidgetFormProps {
  loading?: boolean;
  error?: string | null;
  onCancel?: () => void;
  isEditMode?: boolean;
}

export default function WidgetForm({
  loading = false,
  error,
  onCancel,
  isEditMode = false,
}: WidgetFormProps) {
  const t = useTranslations("widgetForm");
  const widgetTypeOptions = [
    { label: t("typeValues.type_a"), value: "type_a" },
    { label: t("typeValues.type_b"), value: "type_b" },
  ];

  return (
    <div className="flex flex-col h-full max-h-[75vh]">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {error && <AlertComponent title={error} variant="destructive" />}

        {/* Basic info */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("basicInfo")}
            </h3>
          </div>
          <RHFTextField
            name="name"
            label={t("name")}
            placeholder={t("namePlaceholder")}
            fullWidth
          />
          <RHFTextAreaField
            name="description"
            label={t("description")}
            placeholder={t("descriptionPlaceholder")}
            fullWidth
            rows={3}
          />
          <RHFToggleField
            name="isActive"
            label={t("isActive")}
            description={t("isActiveDescription")}
          />
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("configuration")}
            </h3>
          </div>
          <RHFSelectField
            name="type"
            label={t("type")}
            options={widgetTypeOptions}
            placeholder={t("typePlaceholder")}
          />
        </div>
      </div>

      <FormActionFooter
        loading={loading}
        onCancel={onCancel || (() => {})}
        cancelButtonText={t("cancel")}
        submitButtonText={!isEditMode ? t("createWidget") : t("editWidget")}
        loadingText={!isEditMode ? t("creating") : t("editing")}
      />
    </div>
  );
}
