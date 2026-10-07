"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { prepareAccessRequestAction } from "../actions/access-request.actions";
import {
  buildAccessRequestMailto,
  convertAccessRequestDto,
} from "../types/access-request.types";
import type { CreateAccessRequestSchema } from "../../form/create/schemas/create-access-request-schema";

export function usePrepareAccessRequest() {
  const t = useTranslations("accessRequests");
  const emailCopy = useTranslations("accessRequestForm.emailTemplate");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparedEmail, setPreparedEmail] = useState<string | null>(null);

  const prepare = useCallback(
    async (values: CreateAccessRequestSchema) => {
      setIsLoading(true);
      setError(null);
      setPreparedEmail(null);
      try {
        const request = convertAccessRequestDto(values);
        const response = await prepareAccessRequestAction(request);
        if (!response.success) {
          const key = `errors.${response.error.code}`;
          setError(t.has(key as never) ? t(key as never) : response.error.message);
          return;
        }
        const mailto = buildAccessRequestMailto(
          response.data.contactEmail,
          request,
          {
            subject: emailCopy("subject"),
            nameLabel: emailCopy("name"),
            emailLabel: emailCopy("email"),
            organizationLabel: emailCopy("organization"),
            messageLabel: emailCopy("message"),
            notProvided: emailCopy("notProvided"),
          },
        );
        setPreparedEmail(response.data.contactEmail);
        window.location.assign(mailto);
      } catch {
        setError(t("errors.INTERNAL_ERROR"));
      } finally {
        setIsLoading(false);
      }
    },
    [emailCopy, t],
  );

  const reset = useCallback(() => {
    setError(null);
    setPreparedEmail(null);
  }, []);
  return { prepare, isLoading, error, preparedEmail, reset };
}
