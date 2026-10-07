"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TemporaryCredentialDisplay } from "../../components/temporary-credential-display";
import type { ProvisionedTrialUser } from "../../lib/types/user.types";

export function TemporaryCredentialResult({
  result,
  onDone,
}: {
  result: ProvisionedTrialUser;
  onDone: () => void;
}) {
  const t = useTranslations("users.create.credential");

  return (
    <div className="space-y-5 px-6 py-5">
      <TemporaryCredentialDisplay
        email={result.user.email}
        temporaryPassword={result.temporaryPassword}
        expiresAt={result.temporaryPasswordExpiresAt}
      />
      <Button type="button" className="w-full sm:ml-auto sm:w-auto" onClick={onDone}>
        {t("done")}
      </Button>
    </div>
  );
}
