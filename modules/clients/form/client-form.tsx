"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFTextAreaField } from "@/components/form/rhf-components/rhf-text-area-field/rhf-text-area-field";
import FormActionFooter from "@/components/form/components/form-action-footer";
import { AlertComponent } from "@/components/ui/alert-component";
import type { CreateClientSchema } from "./create/schemas/create-client-schema";
import type { ClientDuplicateCandidate } from "../lib/types/client.types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ClientForm({ loading, error, onCancel, mode = "create", duplicates = [], acknowledged = false, onAcknowledge, onValuesChange }: {
  loading: boolean; error: string | null; onCancel: () => void; mode?: "create" | "edit";
  duplicates?: ClientDuplicateCandidate[]; acknowledged?: boolean; onAcknowledge?: (value: boolean) => void;
  onValuesChange?: () => void;
}) {
  const t = useTranslations("clientForm");
  const fields = useTranslations("clients.fields");
  const { formState } = useFormContext<CreateClientSchema>();
  return <div className="flex h-full flex-col">
    <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
      {error && <AlertComponent title={error} variant="destructive" />}
      <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
      <fieldset disabled={loading || formState.isSubmitting} className="space-y-4" onChange={onValuesChange}>
        <RHFTextField name="name" label={fields("name")} fullWidth />
        <div className="grid gap-4 sm:grid-cols-2">
          <RHFTextField name="email" label={fields("email")} type="email" fullWidth />
          <RHFTextField name="phone" label={fields("phone")} type="tel" description={t("phoneHint")} fullWidth />
        </div>
        <RHFTextField name="company" label={fields("company")} fullWidth />
        <RHFTextAreaField name="address" label={fields("address")} rows={2} />
        <RHFTextAreaField name="notes" label={fields("notes")} rows={3} />
      </fieldset>
      {duplicates.length > 0 && (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <h3 className="font-medium">{t("editDuplicatesTitle", { count: duplicates.length })}</h3>
          <p className="text-sm text-muted-foreground">{t("editDuplicatesHint")}</p>
          <ul className="space-y-2 text-sm">
            {duplicates.map((candidate) => <li key={candidate.id} className="rounded-md bg-muted/50 p-3">
              <p className="font-medium">{candidate.name}</p>
              <p className="break-all text-muted-foreground">{[candidate.email, candidate.phone, candidate.company].filter(Boolean).join(" · ")}</p>
            </li>)}
          </ul>
          <div className="flex items-start gap-2">
            <Checkbox id="acknowledge-edit-duplicates" checked={acknowledged} disabled={loading}
              onCheckedChange={(value) => onAcknowledge?.(value === true)} />
            <Label htmlFor="acknowledge-edit-duplicates" className="text-sm leading-relaxed">{t("acknowledgeEditDuplicates")}</Label>
          </div>
        </div>
      )}
    </div>
    <FormActionFooter loading={loading} onCancel={onCancel} cancelButtonText={t("cancel")}
      submitButtonText={t(mode === "edit" ? "save" : "review")}
      loadingText={t(mode === "edit" ? "saving" : "preparing")} />
  </div>;
}
