import { ArrowRight, FileAudio, LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function DemoCtaSection() {
  const t = await getTranslations("landing.demo");

  return (
    <section className="border-y border-white/10 bg-[#0b1728]">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="overflow-hidden rounded-[2rem] border border-violet-300/15 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(135deg,rgba(139,92,246,0.16),rgba(255,255,255,0.025))] p-8 sm:p-12 lg:flex lg:items-end lg:justify-between lg:gap-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">
              <FileAudio className="size-3.5" aria-hidden="true" />
              {t("badge")}
            </div>
            <h2 className="mt-6 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-slate-300">
              {t("description")}
            </p>
            <p className="mt-4 flex max-w-2xl items-start gap-2 text-xs leading-5 text-slate-500">
              <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t("disclosure")}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 shrink-0 rounded-full bg-cyan-300 px-6 text-[#07111f] hover:bg-cyan-200 lg:mt-0"
          >
            <a href="#request-access">
              {t("cta")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
