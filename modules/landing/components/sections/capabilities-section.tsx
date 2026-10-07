import { Bot, Link2, ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";

const capabilityCards = [
  { key: "evidence", icon: Link2, accent: "text-cyan-300 bg-cyan-400/10" },
  { key: "requests", icon: ListChecks, accent: "text-violet-300 bg-violet-400/10" },
  { key: "assistant", icon: Bot, accent: "text-rose-300 bg-rose-400/10" },
] as const;

export async function CapabilitiesSection() {
  const t = await getTranslations("landing.capabilities");

  return (
    <section id="capabilities" className="relative overflow-hidden border-y border-white/10 bg-[#07111f]">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,rgba(139,92,246,0.18),transparent_52%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{t("eyebrow")}</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-pretty text-base leading-7 text-slate-400">{t("description")}</p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {capabilityCards.map(({ key, icon: Icon, accent }) => (
            <article key={key} className="rounded-3xl border border-white/10 bg-white/[0.035] p-7 backdrop-blur">
              <span className={`flex size-12 items-center justify-center rounded-2xl ${accent}`}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-6 text-xl font-semibold text-white">{t(`cards.${key}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{t(`cards.${key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
