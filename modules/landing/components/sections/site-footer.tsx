import { Languages } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "../logo";

export async function SiteFooter() {
  const t = await getTranslations("landing.footer");

  return (
    <footer className="bg-[#050c16]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div>
          <Logo className="text-white" />
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">{t("description")}</p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-slate-500 md:items-end">
          <span className="inline-flex items-center gap-2 text-cyan-300">
            <Languages className="size-3.5" aria-hidden="true" />
            {t("bilingual")}
          </span>
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}
