import { CheckCircle2, Fingerprint, Link2, RefreshCw } from "lucide-react";
import { getTranslations } from "next-intl/server";

const safeguards = [
  { key: "workspace", icon: Fingerprint },
  { key: "approval", icon: CheckCircle2 },
  { key: "provenance", icon: Link2 },
  { key: "portable", icon: RefreshCw },
] as const;

export async function SafeguardsSection() {
  const t = await getTranslations("landing.safeguards");

  return (
    <section id="safeguards" className="bg-white text-slate-950">
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:px-8 lg:py-28">
        <div className="lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">{t("eyebrow")}</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-pretty text-base leading-7 text-slate-600">{t("description")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {safeguards.map(({ key, icon: Icon }) => (
            <article key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <Icon className="size-6 text-violet-600" aria-hidden="true" />
              <h3 className="mt-5 text-base font-semibold">{t(`items.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{t(`items.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
