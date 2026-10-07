"use client";

import SearchInput from "@/components/inputs/search-input/search-input";
import SelectInput from "@/components/inputs/select-input/select-input";
import { Button } from "@/components/ui/button";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useTranslations } from "next-intl";
import { WidgetFilters } from "../lib/types/widget.types";
import { useWidgetUsersForSelect } from "../lib/hooks/use-widget-users-for-select";

interface Props {
  filters: WidgetFilters;
  handleChangeFilters: (newFilters: Partial<WidgetFilters>) => void;
}

export default function WidgetFiltersPresentational({ filters, handleChangeFilters }: Props) {
  const t = useTranslations("filters");
  const {
    users,
    isLoading: usersLoading,
    error: usersError,
    filterValue: usersFilterValue,
    setFilterValue: setUsersFilterValue,
    hasNextPage: usersHasNextPage,
    isFetchingNextPage: usersFetchingNextPage,
    loadNextPage: loadNextUsersPage,
  } = useWidgetUsersForSelect();

  const isActiveOptions = [
    { label: t("active"), value: "true" },
    { label: t("inactive"), value: "false" },
  ];

  const sortByOptions = [
    { label: t("sortByName"), value: "name" },
    { label: t("sortByCreated"), value: "createdAt" },
  ];

  return (
    <div className="grid gap-2 2xl:gap-3 items-center grid-cols-1 sm:grid-cols-2 2xl:grid-cols-[2fr_1fr_1fr_auto]">
      <div className="sm:col-span-2 2xl:col-span-1">
        <SearchInput
          id="widgets-search"
          placeHolder={t("searchByNameDescription")}
          value={filters.search}
          onChange={(e) => handleChangeFilters({ search: e.target.value })}
        />
      </div>
      <div>
        <SelectInput
          placeholder={t("status")}
          value={filters.isActive === "" ? "" : filters.isActive.toString()}
          onValueChange={(value) =>
            handleChangeFilters({ isActive: value === "true" ? true : value === "false" ? false : "" })
          }
          options={isActiveOptions}
          clearable={{ handleClear: () => handleChangeFilters({ isActive: "" }) }}
        />
      </div>
      <div>
        <SelectInput
          placeholder={t("user")}
          value={filters.createdBy}
          onValueChange={(createdBy) => handleChangeFilters({ createdBy })}
          options={users.map((user) => ({ label: user.label, value: user.id }))}
          loading={usersLoading}
          emptyText={usersError ?? undefined}
          filterValue={usersFilterValue}
          onFilterChange={setUsersFilterValue}
          filterPlaceholder={t("searchByNameDescription")}
          hasNextPage={usersHasNextPage}
          isFetchingNextPage={usersFetchingNextPage}
          onLoadNextPage={loadNextUsersPage}
          clearable={{ handleClear: () => handleChangeFilters({ createdBy: "" }) }}
        />
      </div>
      <div className="flex items-center gap-2">
        <SelectInput
          placeholder={t("sortBy")} label={t("sortBy")} labelVariant="inside"
          value={filters.sortBy}
          onValueChange={(value) => handleChangeFilters({ sortBy: value })}
          options={sortByOptions}
          fullWidth={false}
        />
        <Button size="icon" variant="outline"
          onClick={() => handleChangeFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
          aria-label={filters.sortOrder === "asc" ? t("sortDescending") : t("sortAscending")}
        >
          {filters.sortOrder === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
