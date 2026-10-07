import { AudioLines, FileCheck2, Mic2, ScanText, UserRoundCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

const workflowSteps = [
  { key: "capture", icon: Mic2 },
  { key: "transcribe", icon: AudioLines },
  { key: "structure", icon: ScanText },
  { key: "review", icon: UserRoundCheck },
  { key: "confirm", icon: FileCheck2 },
] as const;

export async function WorkflowSection() {
  const t = await getTranslations("landing.workflow");

  return (
    <section id="workflow" className="bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">{t("eyebrow")}</p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            {t("title")}
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600">
            {t("description")}
          </p>
        </div>

        <ol className="mt-14 grid gap-4 lg:grid-cols-5">
          {workflowSteps.map(({ key, icon: Icon }, index) => (
            <li
              key={key}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="absolute right-3 top-2 text-5xl font-semibold tracking-tighter text-slate-100">
                0{index + 1}
              </div>
              <span className="relative flex size-10 items-center justify-center rounded-xl bg-slate-950 text-cyan-300">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="relative mt-8 text-base font-semibold">{t(`steps.${key}.title`)}</h3>
              <p className="relative mt-2 text-sm leading-6 text-slate-600">
                {t(`steps.${key}.description`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
