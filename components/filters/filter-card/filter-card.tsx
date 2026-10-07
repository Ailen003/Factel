"use client";
import { ReactNode } from "react";
import { Filter } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  children: ReactNode;
  activeFilters?: ReactNode;
  title?: string;
}

export default function FilterCard({ children, activeFilters, title }: Props) {
  const t = useTranslations('common');
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div
        className="border-b border-border px-4 py-3"
        style={{ background: 'linear-gradient(180deg, #F4F8EC 0%, #EEF4FB 100%)' }}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-foreground" />
          <h3 className="text-xs font-semibold text-foreground sm:text-sm">{title || t('filters')}</h3>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
      {activeFilters && (
        <div className="border-t border-border bg-muted/40 px-4 py-3">
          {activeFilters}
        </div>
      )}
    </div>
  );
}
