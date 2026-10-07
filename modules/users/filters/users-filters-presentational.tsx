"use client";
import SearchInput from "@/components/inputs/search-input/search-input";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserFilters } from "./hooks/use-users-filters";
import {
  getUserRoleLabel,
  getUserStatusLabel,
} from "../lib/types/user.types";

interface Props {
  filters: UserFilters;
  handleChangeFilters: (newFilters: Partial<UserFilters>) => void;
}

export default function UsersFiltersPresentational({
  filters,
  handleChangeFilters,
}: Props) {
  const t = useTranslations('filters');
  const tCommon = useTranslations('common');
  const tUserRole = useTranslations('users.roleValues');
  const tUserStatus = useTranslations('users.statusValues');
  const roleOptions = [
    { label: getUserRoleLabel("platform_admin", tUserRole), value: "platform_admin" },
    { label: getUserRoleLabel("trial_user", tUserRole), value: "trial_user" },
  ];

  const statusOptions = [
    { label: getUserStatusLabel("active", tUserStatus), value: "active" },
    {
      label: getUserStatusLabel("suspended", tUserStatus),
      value: "suspended",
    },
  ];

  const sortByOptions = [
    { label: t('sortByName'), value: "fullName" },
    { label: t('sortByEmail'), value: "email" },
    { label: t('sortByRole'), value: "role" },
    { label: t('sortByStatus'), value: "status" },
    { label: t('sortByCreated'), value: "createdAt" },
  ];

  return (
    <div className="grid gap-2 2xl:gap-3 items-center grid-cols-1 sm:grid-cols-2 2xl:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="sm:col-span-2 2xl:col-span-1">
        <SearchInput
          id="users-search"
          placeHolder={t('searchByNameOrEmail')}
          value={filters.search}
          onChange={(e) => {
            handleChangeFilters({ search: e.target.value });
          }}
        />
      </div>

      <div>
        <SelectInput
          placeholder={tCommon('role')}
          value={filters.role}
          onValueChange={(value) =>
            handleChangeFilters({ role: value as UserFilters["role"] })
          }
          options={roleOptions}
          clearable={{
            handleClear: () => handleChangeFilters({ role: "" }),
          }}
        />
      </div>

      <div>
        <SelectInput
          placeholder={tCommon('status')}
          value={filters.status}
          onValueChange={(value) =>
            handleChangeFilters({ status: value as UserFilters["status"] })
          }
          options={statusOptions}
          clearable={{
            handleClear: () => handleChangeFilters({ status: "" }),
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <SelectInput
          placeholder={t('sortBy')}
          label={t('sortBy')}
          labelVariant="inside"
          value={filters.sortBy}
          onValueChange={(value) =>
            handleChangeFilters({ sortBy: value as UserFilters["sortBy"] })
          }
          options={sortByOptions}
          fullWidth={false}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => {
            handleChangeFilters({
              sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
            });
          }}
          aria-label={
            filters.sortOrder === "asc"
              ? t('sortDescending')
              : t('sortAscending')
          }
        >
          {filters.sortOrder === "asc" ? (
            <ArrowDownAZ className="h-4 w-4" />
          ) : (
            <ArrowUpZA className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
