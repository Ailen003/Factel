import {
  Check,
  CircleUserRound,
  Link2,
  MessagesSquare,
  WandSparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

const waveform = [18, 32, 22, 48, 74, 44, 90, 58, 36, 70, 52, 28, 62, 42, 20];

export async function ConversationPreview() {
  const t = await getTranslations("landing.preview");

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-violet-500/10 blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d192a]/90 shadow-2xl shadow-black/40 ring-1 ring-white/5">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-rose-400" />
            </span>
            {t("session")}
          </div>
          <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] text-slate-400">
            {t("duration")}
          </span>
        </div>

        <div className="grid gap-px bg-white/10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-[#0b1727] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                {t("transcript")}
              </span>
              <span className="text-[10px] text-slate-500">{t("source")}</span>
            </div>

            <div className="mt-4 flex h-16 items-center gap-1 rounded-xl border border-cyan-300/10 bg-cyan-300/5 px-4">
              {waveform.map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="flex-1 rounded-full bg-gradient-to-t from-violet-500 to-cyan-300"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-violet-300">
                  <MessagesSquare className="size-3" aria-hidden="true" />
                  {t("speakerA")}
                </div>
                <p className="text-xs leading-5 text-slate-300">{t("lineA")}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-cyan-300">
                  <MessagesSquare className="size-3" aria-hidden="true" />
                  {t("speakerB")}
                </div>
                <p className="text-xs leading-5 text-slate-300">{t("lineB")}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0e1b2d] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                {t("proposal")}
              </span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                {t("awaitingReview")}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3.5">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  <CircleUserRound className="size-3.5 text-cyan-300" aria-hidden="true" />
                  {t("client")}
                </div>
                <p className="mt-2 text-sm font-medium text-white">{t("clientValue")}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t("contactValue")}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.045] p-3.5">
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  <WandSparkles className="size-3.5 text-violet-300" aria-hidden="true" />
                  {t("request")}
                </div>
                <p className="mt-2 text-sm font-medium text-white">{t("requestValue")}</p>
                <p className="mt-1 text-[11px] text-slate-400">{t("requestMeta")}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-3.5 py-3">
              <span className="flex items-center gap-2 text-[10px] text-emerald-200">
                <Link2 className="size-3.5" aria-hidden="true" />
                {t("evidenceLinked")}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                <Check className="size-3.5 text-emerald-300" aria-hidden="true" />
                {t("ready")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
