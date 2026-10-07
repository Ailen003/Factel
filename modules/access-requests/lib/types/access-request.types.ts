import type { CreateAccessRequestSchema } from "../../form/create/schemas/create-access-request-schema";

export interface AccessRequestDto {
  fullName: string;
  email: string;
  organization?: string;
  message: string;
}

export interface PreparedAccessRequest {
  contactEmail: string;
}

export interface AccessRequestEmailCopy {
  subject: string;
  nameLabel: string;
  emailLabel: string;
  organizationLabel: string;
  messageLabel: string;
  notProvided: string;
}

export const convertAccessRequestDto = (
  schema: CreateAccessRequestSchema,
): AccessRequestDto => ({
  fullName: schema.fullName.trim(),
  email: schema.email.trim().toLowerCase(),
  organization: schema.organization.trim() || undefined,
  message: schema.message.trim(),
});

export function buildAccessRequestMailto(
  contactEmail: string,
  request: AccessRequestDto,
  copy: AccessRequestEmailCopy,
): string {
  const body = [
    `${copy.nameLabel}: ${request.fullName}`,
    `${copy.emailLabel}: ${request.email}`,
    `${copy.organizationLabel}: ${request.organization ?? copy.notProvided}`,
    "",
    `${copy.messageLabel}:`,
    request.message,
  ].join("\r\n");
  const query = new URLSearchParams({
    subject: copy.subject,
    body,
  });
  return `mailto:${encodeURIComponent(contactEmail)}?${query.toString()}`;
}
