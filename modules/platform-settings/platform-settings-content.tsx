import Link from "next/link";
import { Settings2, ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAdminCapability } from "@/lib/auth/admin-authorization";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ModuleHeader } from "@/modules/components/module-header/module-header";
import { getPlatformSettings } from "./lib/services/platform-settings.services";
import {
  PlatformAdmissionControl,
  PlatformSettingsFormContainer,
} from "./form/platform-settings-form-container";

export default async function PlatformSettingsContent() {
  await requireAdminCapability("platform.settings.read");
  const [t, locale] = await Promise.all([
    getTranslations("platformSettings"),
    getLocale(),
  ]);
  const response = await getPlatformSettings();
  const errorKey = !response.success ? `errors.${response.error.code}` : null;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title={t("title")}
        description={t("description")}
        icon={<Settings2 className="size-9" aria-hidden="true" />}
        showRefresh
      />
      {!response.success ? (
        <AlertComponent
          title={errorKey && t.has(errorKey as never)
            ? t(errorKey as never)
            : response.error.message}
          variant="destructive"
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("contact.title")}</CardTitle>
              <CardDescription>{t("contact.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformSettingsFormContainer settings={response.data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("admission.title")}</CardTitle>
              <CardDescription>{t("admission.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PlatformAdmissionControl settings={response.data} />
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            {t("security.title")}
          </CardTitle>
          <CardDescription>{t("security.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={`/${locale}/auth/two-factor/setup?returnTo=%2Fsettings`}>
              {t("security.manageBackupCodes")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
