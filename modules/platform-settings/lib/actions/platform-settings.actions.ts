"use server";

import {
  platformAdmissionMutationSchema,
  updatePlatformContactEmailSchema,
} from "../types/platform-settings.types";
import {
  getPlatformSettings,
  pauseAccessRequests,
  resumeAccessRequests,
  updatePlatformContactEmail,
} from "../services/platform-settings.services";

const validationError = () => ({
  success: false as const,
  error: { code: "VALIDATION_ERROR", message: "Invalid platform settings" },
});

export async function getPlatformSettingsAction() {
  return getPlatformSettings();
}

export async function updatePlatformContactEmailAction(input: unknown) {
  const parsed = updatePlatformContactEmailSchema.safeParse(input);
  return parsed.success
    ? updatePlatformContactEmail(parsed.data)
    : validationError();
}

export async function pauseAccessRequestsAction(input: unknown) {
  const parsed = platformAdmissionMutationSchema.safeParse(input);
  return parsed.success ? pauseAccessRequests(parsed.data) : validationError();
}

export async function resumeAccessRequestsAction(input: unknown) {
  const parsed = platformAdmissionMutationSchema.safeParse(input);
  return parsed.success ? resumeAccessRequests(parsed.data) : validationError();
}
