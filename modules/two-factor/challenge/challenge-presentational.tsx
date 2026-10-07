"use client";

import { KeyRound, Loader2, LogOut, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { AlertComponent } from "@/components/ui/alert-component";
import { Button } from "@/components/ui/button";
import { SensitiveCodeField } from "../components/sensitive-code-field";
import { TotpCodeField } from "../components/totp-code-field";

function ChallengeFrame({
  loading,
  error,
  isBackup,
  onSwitchMode,
  onRestart,
  onSignOut,
  children,
}: {
  loading: boolean;
  error: string | null;
  isBackup: boolean;
  onSwitchMode: () => void;
  onRestart: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("twoFactor.challenge");
  return (
    <fieldset disabled={loading} className="space-y-5">
      {error && <div aria-live="assertive"><AlertComponent title={error} variant="destructive" /></div>}
      {children}
      <Button type="submit" className="w-full">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t("verifying")}</> : t("verify")}
      </Button>
      <div className="border-t pt-4">
        <Button type="button" variant="link" className="h-auto w-full whitespace-normal" onClick={onSwitchMode}>
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          {isBackup ? t("useAuthenticator") : t("useBackupCode")}
        </Button>
      </div>
      <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t("lostFactorsTitle")}</p>
        <p className="mt-1">{t("lostFactorsDescription")}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Button type="button" variant="ghost" onClick={onSignOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />{t("signOut")}
        </Button>
        <Button type="button" variant="ghost" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />{t("restart")}
        </Button>
      </div>
    </fieldset>
  );
}

export function TotpChallengeForm(props: Omit<React.ComponentProps<typeof ChallengeFrame>, "children" | "isBackup">) {
  const t = useTranslations("twoFactor.challenge");
  return (
    <ChallengeFrame {...props} isBackup={false}>
      <TotpCodeField
        name="code"
        label={t("totpLabel")}
        description={t("totpDescription")}
        disabled={props.loading}
        autoFocus
      />
    </ChallengeFrame>
  );
}

export function BackupChallengeForm(props: Omit<React.ComponentProps<typeof ChallengeFrame>, "children" | "isBackup">) {
  const t = useTranslations("twoFactor.challenge");
  return (
    <ChallengeFrame {...props} isBackup>
      <SensitiveCodeField
        name="code"
        label={t("backupLabel")}
        placeholder={t("backupPlaceholder")}
        description={t("backupDescription")}
        disabled={props.loading}
        autoFocus
      />
    </ChallengeFrame>
  );
}
