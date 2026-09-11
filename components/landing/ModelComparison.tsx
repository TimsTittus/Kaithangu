import { CheckCircle2, Scale, XCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function ModelComparison() {
  const t = await getTranslations('landing');

  const comparisonPoints = [
    {
      title: t('point_commission_title'),
      corp: t('point_commission_corp'),
      coop: t('point_commission_coop'),
    },
    {
      title: t('point_welfare_title'),
      corp: t('point_welfare_corp'),
      coop: t('point_welfare_coop'),
    },
    {
      title: t('point_ownership_title'),
      corp: t('point_ownership_corp'),
      coop: t('point_ownership_coop'),
    },
    {
      title: t('point_access_title'),
      corp: t('point_access_corp'),
      coop: t('point_access_coop'),
    },
    {
      title: t('point_pricing_title'),
      corp: t('point_pricing_corp'),
      coop: t('point_pricing_coop'),
    },
  ];

  return (
    <section
      id="comparison"
      className="scroll-mt-20 py-12 md:py-20 bg-neutral-100/70 dark:bg-[#0a1410]/50"
    >
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/90 px-3.5 py-1 text-xs font-bold text-amber-900 border border-amber-300/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/40">
            <Scale className="size-3.5 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <span>{t('contrast_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-neutral-950 dark:text-white">
            {t('contrast_title')}
          </h2>

          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
            {t('contrast_subtitle')}
          </p>
        </div>

        {/* Side-by-Side Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: Corporate Aggregators */}
          <div className="flex flex-col rounded-3xl border border-red-200/80 bg-white/90 p-6 shadow-sm dark:border-red-900/40 dark:bg-[#161011]/80">
            <div className="flex items-center justify-between border-b border-red-100 dark:border-red-900/30 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Exploitative Status Quo
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {t('col_corporate')}
                </h3>
              </div>
              <div className="flex size-10 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                <XCircle className="size-6" aria-hidden="true" />
              </div>
            </div>

            <ul className="mt-6 flex flex-col gap-5 flex-1 justify-between">
              {comparisonPoints.map((pt) => (
                <li key={pt.title} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    {pt.title}
                  </span>
                  <p className="text-neutral-600 dark:text-neutral-400 pl-3 leading-relaxed">
                    {pt.corp}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Kaithangu Cooperative */}
          <div className="flex flex-col rounded-3xl border-2 border-emerald-500 bg-emerald-50/20 p-6 shadow-md dark:border-emerald-500/70 dark:bg-[#0e2118]/80 relative overflow-hidden">
            {/* Top highlight ribbon */}
            <div className="absolute top-0 right-0 rounded-bl-2xl bg-emerald-700 px-3 py-1 text-[11px] font-bold tracking-wide uppercase text-white shadow-sm">
              Ministry of Cooperation
            </div>

            <div className="flex items-center justify-between border-b border-emerald-200/80 dark:border-emerald-800/60 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  National Cooperative Model
                </span>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {t('col_cooperative')}
                </h3>
              </div>
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
            </div>

            <ul className="mt-6 flex flex-col gap-5 flex-1 justify-between">
              {comparisonPoints.map((pt) => (
                <li key={pt.title} className="flex flex-col gap-1 text-sm">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {pt.title}
                  </span>
                  <p className="text-neutral-700 dark:text-neutral-300 pl-5 leading-relaxed font-medium">
                    {pt.coop}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
