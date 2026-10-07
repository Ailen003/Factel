"use client";

import { useCallback, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { AlertComponent } from "@/components/ui/alert-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlatformSettings } from "../lib/types/platform-settings.types";
import {
  platformSettingsSchemaFactory,
  type PlatformSettingsSchema,
} from "./schemas/platform-settings-schema";
import {
  useSetPlatformAdmission,
  useUpdatePlatformContactEmail,
} from "../lib/hooks/use-update-platform-settings";
import { PlatformSettingsForm } from "./platform-settings-form";

export function PlatformSettingsFormContainer({
  settings,
}: {
  settings: PlatformSettings;
}) {
  const router = useRouter();
  const t = useTranslations("platformSettings");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const success = useCallback(() => {
    const message = t("contact.success");
    setSuccessMessage(message);
    toast.success(message, { position: "top-right" });
    setTimeout(() => router.refresh(), 300);
  }, [router, t]);
  const { updateContact, isLoading, error } = useUpdatePlatformContactEmail(success);
  const form = useForm<PlatformSettingsSchema>({
    resolver: zodResolver(
      platformSettingsSchemaFactory({
        invalidEmail: t("form.validation.invalidEmail"),
      }),
    ),
    defaultValues: {
      accessContactEmail: settings.accessContactEmail,
    },
  });

  if (!settings.canUpdateContact) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("form.contactEmail")}</p>
        <p className="break-all font-mono text-sm text-muted-foreground">
          {settings.accessContactEmail}
        </p>
        <p className="text-xs text-muted-foreground">{t("contact.ownerOnly")}</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          setSuccessMessage(null);
          return updateContact(values.accessContactEmail, settings.version);
        })}
        noValidate
      >
        <PlatformSettingsForm loading={isLoading} error={error} />
        {successMessage && <p className="mt-3 text-sm text-green-700" role="status">{successMessage}</p>}
      </form>
    </FormProvider>
  );
}

export function PlatformAdmissionControl({
  settings,
}: {
  settings: PlatformSettings;
}) {
  const router = useRouter();
  const t = useTranslations("platformSettings.admission");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const success = useCallback(() => {
    const message = settings.accessRequestsEnabled ? t("pauseSuccess") : t("resumeSuccess");
    setSuccessMessage(message);
    toast.success(message, { position: "top-right" });
    setTimeout(() => router.refresh(), 300);
  }, [router, settings.accessRequestsEnabled, t]);
  const { setAdmission, isLoading, error } = useSetPlatformAdmission(success);
  const canPause = settings.accessRequestsEnabled && settings.canPause;
  const canResume = !settings.accessRequestsEnabled && settings.canResume;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("statusLabel")}</p>
          <Badge variant="outline" className={settings.accessRequestsEnabled ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
            {t(settings.accessRequestsEnabled ? "enabled" : "paused")}
          </Badge>
        </div>
        {canPause && (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isLoading}
            onClick={() => {
              setSuccessMessage(null);
              void setAdmission(false, settings.version);
            }}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
            {isLoading ? t("pausing") : t("pause")}
          </Button>
        )}
        {canResume && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isLoading}
            onClick={() => {
              setSuccessMessage(null);
              void setAdmission(true, settings.version);
            }}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="size-4" aria-hidden="true" />}
            {isLoading ? t("resuming") : t("resume")}
          </Button>
        )}
      </div>
      {!settings.accessRequestsEnabled && !settings.canResume && (
        <p className="text-sm text-muted-foreground">{t("ownerOnlyResume")}</p>
      )}
      {error && <AlertComponent title={error} variant="destructive" />}
      {successMessage && <p className="text-sm text-green-700" role="status">{successMessage}</p>}
    </div>
  );
}
