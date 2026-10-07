"use client";

import { AudioLines } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface LogoProps {
  compact?: boolean;
  className?: string;
}

export function Logo({ compact = false, className }: LogoProps) {
  const t = useTranslations("app");

  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2.5 text-foreground", className)}
      aria-label={t("name")}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 via-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/20">
        <AudioLines className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="max-w-[12rem] text-left text-sm font-semibold leading-tight tracking-tight sm:max-w-none sm:text-base">
          {t("name")}
        </span>
      )}
    </Link>
  );
}
