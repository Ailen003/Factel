import {
  Mail,
  Shield,
  Calendar,
  Clock,
  CircleDot,
  Coins,
  Languages,
  KeyRound,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  UserDetails,
  getUserAccessState,
  userAccessStateConfig,
} from "../lib/types/user.types";
import { formatDateTime } from "@/lib/utils/dates";
import { CredentialIssuanceBadge } from "../components/credential-issuance-badge";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(fullName?: string | null, email?: string | null) {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">{label}</p>
        <p
          className={cn(
            "mt-0.5 text-xs text-foreground break-all sm:text-sm",
            mono && "font-mono",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  user: UserDetails;
  canManageAdmins?: boolean;
  canManageTrialUsers?: boolean;
  onCredentialReissue?: (user: UserDetails) => void;
  onCredentialDeliveryConfirm?: (user: UserDetails) => void;
}

export function UserDetailsPresentational({ user, canManageAdmins = false, canManageTrialUsers = false, onCredentialReissue, onCredentialDeliveryConfirm }: Props) {
  const t = useTranslations('userDetailsSection');
  const tTable = useTranslations('table');
  const tUserRole = useTranslations('users.roleValues');
  const tUserAccess = useTranslations('users.accessValues');
  const tUserLocale = useTranslations('users.localeValues');
  const tCredential = useTranslations('users.credentialReissue');
  const { fullName, email, role, locale, initialCreditAllocation, createdAt, updatedAt } = user;
  const accessState = getUserAccessState(user);
  const roleKey = role === "trial_user"
    ? "trial_user"
    : user.adminProfile ?? "unconfiguredAdmin";
  const displayName = fullName || email || t('unknownUser');
  const canConfirmCredentialDelivery =
    user.latestTemporaryCredentialIssuance?.status === "issued" &&
    user.latestTemporaryCredentialIssuance.deliveredAt === null &&
    user.latestTemporaryCredentialIssuance.version === user.temporaryCredentialVersion;

  return (
    <div className="flex flex-col gap-5 font-sans">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center",
            "rounded-full bg-primary text-primary-foreground",
            "text-base sm:text-lg font-semibold tracking-wide select-none",
          )}
        >
          {getInitials(fullName, email)}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
            {displayName}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            {tUserRole(roleKey)}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs",
                userAccessStateConfig[accessState].className,
              )}
            >
              {tUserAccess(accessState)}
            </Badge>
          </div>
        </div>
      </div>

      {user.latestTemporaryCredentialIssuance && (
        <div>
          <SectionDivider label={tCredential('latestIssuance')} />
          <div className="divide-y divide-border">
            <InfoRow
              icon={CircleDot}
              label={tCredential('issuanceState')}
              value={<CredentialIssuanceBadge issuance={user.latestTemporaryCredentialIssuance} />}
            />
            <InfoRow
              icon={KeyRound}
              label={tCredential('purposeLabel')}
              value={tCredential(`purpose.${user.latestTemporaryCredentialIssuance.purpose}`)}
            />
            <InfoRow
              icon={Shield}
              label={tCredential('reasonLabel')}
              value={tCredential(`reasons.${user.latestTemporaryCredentialIssuance.reason}`)}
            />
            <InfoRow
              icon={Calendar}
              label={tCredential('issuedAt')}
              value={formatDateTime(user.latestTemporaryCredentialIssuance.issuedAt ?? user.latestTemporaryCredentialIssuance.preparedAt)}
            />
            {user.latestTemporaryCredentialIssuance.expiresAt && (
              <InfoRow
                icon={Clock}
                label={tCredential('expiresAt')}
                value={formatDateTime(user.latestTemporaryCredentialIssuance.expiresAt)}
              />
            )}
            {user.latestTemporaryCredentialIssuance.deliveredAt && (
              <InfoRow
                icon={Send}
                label={tCredential('deliveredAt')}
                value={formatDateTime(user.latestTemporaryCredentialIssuance.deliveredAt)}
              />
            )}
            {user.latestTemporaryCredentialIssuance.deliveryChannel && (
              <InfoRow
                icon={Send}
                label={tCredential('deliveryChannelLabel')}
                value={tCredential(`channels.${user.latestTemporaryCredentialIssuance.deliveryChannel}`)}
              />
            )}
          </div>
        </div>
      )}

      <div>
        <SectionDivider label={t('account')} />
        <div className="divide-y divide-border">
          <InfoRow icon={Mail} label={tTable('email')} value={email ?? "—"} mono />
          <InfoRow icon={Shield} label={tTable('role')} value={tUserRole(roleKey)} />
          <InfoRow
            icon={CircleDot}
            label={tTable('status')}
            value={tUserAccess(accessState)}
          />
          {user.temporaryPasswordExpiresAt && (
            <InfoRow icon={KeyRound} label={t('temporaryPasswordExpiresAt')} value={formatDateTime(user.temporaryPasswordExpiresAt)} />
          )}
          {user.trialActivatedAt && (
            <InfoRow icon={Shield} label={t('trialActivatedAt')} value={formatDateTime(user.trialActivatedAt)} />
          )}
          {user.trialExpiresAt && (
            <InfoRow icon={Clock} label={t('trialExpiresAt')} value={formatDateTime(user.trialExpiresAt)} />
          )}
          <InfoRow icon={Languages} label={t('locale')} value={tUserLocale(locale)} />
          <InfoRow icon={Coins} label={t('initialCreditAllocation')} value={initialCreditAllocation} />
        </div>
      </div>

      <div>
        <SectionDivider label={t('timestamps')} />
        <div className="divide-y divide-border">
          <InfoRow
            icon={Calendar}
            label={tTable('created')}
            value={formatDateTime(createdAt)}
          />
          <InfoRow
            icon={Clock}
            label={t('lastUpdated')}
            value={formatDateTime(updatedAt)}
          />
        </div>
      </div>

      {user.role === "platform_admin" && !canManageAdmins && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {t('adminOwnerOnly')}
        </div>
      )}
      {user.role === "trial_user" && canManageTrialUsers && onCredentialReissue && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onCredentialReissue(user)}
        >
          <KeyRound className="h-4 w-4" />
          {tCredential(user.trialActivatedAt === null ? "action.activation" : "action.recovery")}
        </Button>
      )}
      {user.role === "trial_user" && canManageTrialUsers && canConfirmCredentialDelivery && onCredentialDeliveryConfirm && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => onCredentialDeliveryConfirm(user)}
        >
          <Send className="h-4 w-4" />
          {tCredential("confirmDelivery")}
        </Button>
      )}
    </div>
  );
}
