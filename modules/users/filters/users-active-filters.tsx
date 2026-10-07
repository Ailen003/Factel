"use client";

import { Button } from "@/components/ui/button";
import FilterBadge from "@/components/filters/filter-badge/filter-badge";
import { ListFilter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { UserFilters } from "./hooks/use-users-filters";
import {
  UserRole,
  UserStatus,
  getUserRoleLabel,
  getUserStatusLabel,
} from "../lib/types/user.types";

interface Props {
  filters: UserFilters;
  activeFiltersCount: number;
  handleChangeFilters: (newFilters: Partial<UserFilters>) => void;
  handleResetFilters: () => void;
}

export default function UsersActiveFilters({
  filters,
  activeFiltersCount,
  handleChangeFilters,
  handleResetFilters,
}: Props) {
  const t = useTranslations('users.filters');
  const tUserRole = useTranslations('users.roleValues');
  const tUserStatus = useTranslations('users.statusValues');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListFilter className="h-3.5 w-3.5" />
        <span>
          {activeFiltersCount} {t('active')}{" "}
          {activeFiltersCount === 1 ? t('filter') : t('filters')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {filters.search && (
          <FilterBadge
            filterName={t('search')}
            filterValue={filters.search}
            handleDeleteFilter={() => handleChangeFilters({ search: "" })}
          />
        )}
        {filters.role && (
          <FilterBadge
            filterName={t('role')}
            filterValue={getUserRoleLabel(filters.role as UserRole, tUserRole)}
            handleDeleteFilter={() => handleChangeFilters({ role: "" })}
          />
        )}
        {filters.status && (
          <FilterBadge
            filterName={t('status')}
            filterValue={getUserStatusLabel(filters.status as UserStatus, tUserStatus)}
            handleDeleteFilter={() => handleChangeFilters({ status: "" })}
          />
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground ml-auto"
        onClick={handleResetFilters}
      >
        <X className="h-3 w-3" />
        {t('clearAll')}
      </Button>
    </div>
  );
}
