"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RHFTextField } from "@/components/form/rhf-components/rhf-text-field/rhf-text-field";
import { RHFPasswordField } from "@/components/form/rhf-components/rhf-password-field/rhf-password-field";
import { Button } from "@/components/ui/button";
import { AlertComponent } from "@/components/ui/alert-component";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginForm({
  loading = false,
  error,
}: {
  loading?: boolean;
  error?: string | null;
}) {
  const t = useTranslations("loginForm");
  const tContent = useTranslations("loginContent");
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{tContent("title")}</CardTitle>
        <CardDescription>{tContent("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && <AlertComponent title={error} variant="destructive" />}
          <RHFTextField
            name="email"
            label={t("email")}
            placeholder={t("emailPlaceholder")}
            type="email"
            fullWidth
          />
          <RHFPasswordField
            name="password"
            label={t("password")}
            placeholder={t("passwordPlaceholder")}
            showPasswordLabel={t("showPassword")}
            hidePasswordLabel={t("hidePassword")}
            fullWidth
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("signingIn")}</>
            ) : t("signIn")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
