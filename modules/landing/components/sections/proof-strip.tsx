import { getTranslations } from "next-intl/server";

const proofItems = ["recording", "bilingual", "review", "confirmation"] as const;

export async function ProofStrip() {
  const t = await getTranslations("landing.proof");

  return (
    <section className="border-b border-white/10 bg-[#091524]" aria-label={t("label")}>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        {proofItems.map((key) => (
          <div key={key} className="bg-[#091524] px-5 py-7 text-center">
            <p className="text-sm font-semibold text-white">{t(`${key}.title`)}</p>
            <p className="mt-1 text-xs text-slate-500">{t(`${key}.description`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
