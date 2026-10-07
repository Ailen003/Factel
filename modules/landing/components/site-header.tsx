"use client";

import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { paths } from "@/routes/paths";
import { Logo } from "./logo";

export function SiteHeader() {
  const t = useTranslations("landing.nav");

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111f]/90 text-slate-100 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo className="text-white" />

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("primaryLabel")}>
          <a className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white" href="#workflow">
            {t("workflow")}
          </a>
          <a className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white" href="#capabilities">
            {t("capabilities")}
          </a>
          <a className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white" href="#safeguards">
            {t("safeguards")}
          </a>
          <a className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white" href="#request-access">
            {t("contact")}
          </a>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle />
          <Button asChild variant="ghost" className="hidden text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex">
            <Link href={paths.authLogin.root}>{t("signIn")}</Link>
          </Button>
          <Button asChild className="rounded-full bg-white px-4 text-[#07111f] hover:bg-cyan-100">
            <a href="#request-access">{t("requestAccess")}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
