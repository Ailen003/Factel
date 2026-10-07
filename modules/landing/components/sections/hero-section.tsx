import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ConversationPreview } from "../conversation-preview";

export async function HeroSection() {
  const t = await getTranslations("landing.hero");

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.22),transparent_32%),radial-gradient(circle_at_16%_58%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#07111f_0%,#0a1526_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:54px_54px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]" />

      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-28">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t("badge")}
          </div>

          <h1 className="mt-7 max-w-3xl text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-4xl lg:text-4xl">
            {t("titleLead")}{" "}
            <span className="bg-gradient-to-r from-violet-300 via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              {t("titleAccent")}
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
            {t("description")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-violet-500 px-6 text-white shadow-xl shadow-violet-950/50 hover:bg-violet-400"
            >
              <a href="#request-access">
                {t("primaryCta")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#workflow">{t("secondaryCta")}</a>
            </Button>
          </div>

          <p className="mt-5 flex max-w-xl items-start gap-2 text-xs leading-5 text-slate-400">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" aria-hidden="true" />
            {t("footnote")}
          </p>
        </div>

        <ConversationPreview />
      </div>
    </section>
  );
}
