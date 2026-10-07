import { CheckCircle2, Clock3, MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AlertComponent } from "@/components/ui/alert-component";
import { getPublicAccessContactSettings } from "@/modules/platform-settings/lib/services/platform-settings.services";
import { CreateAccessRequestFormContainer } from "./form/create/create-access-request-form-container";

const steps = [
  { key: "send", icon: MailCheck },
  { key: "review", icon: Clock3 },
  { key: "reply", icon: CheckCircle2 },
] as const;

export default async function AccessRequestsContent() {
  const t = await getTranslations("accessRequests");
  const response = await getPublicAccessContactSettings();
  const available = response.success && response.data.available;

  return (
    <section id="request-access" className="border-y border-white/10 bg-[#0b1728]">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            {t("title")}
          </h2>
          <p className="mt-5 text-pretty text-base leading-7 text-slate-300">
            {t("description")}
          </p>
          <div className="mt-8 space-y-5">
            {steps.map(({ key, icon: Icon }) => (
              <div key={key} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10">
                  <Icon className="size-5 text-violet-200" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{t(`steps.${key}.title`)}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{t(`steps.${key}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-[#07111f] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <h3 className="text-xl font-semibold text-white">{t("formTitle")}</h3>
          <p className="mt-2 mb-6 text-sm leading-6 text-slate-400">{t("formDescription")}</p>
          {available ? (
            <CreateAccessRequestFormContainer />
          ) : (
            <AlertComponent
              title={t("unavailableTitle")}
              description={t("unavailableDescription")}
            />
          )}
        </div>
      </div>
    </section>
  );
}
