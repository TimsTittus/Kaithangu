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
      className="scroll-mt-20 py-12 md:py-20 bg-[#f8fafc] border-b border-slate-200"
    >
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900 border border-amber-300/80 shadow-2xs">
            <Scale className="size-3.5 text-amber-700" aria-hidden="true" />
            <span>{t('contrast_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#07254d]">
            {t('contrast_title')}
          </h2>

          <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            {t('contrast_subtitle')}
          </p>
        </div>

        {/* Side-by-Side Comparative Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: Corporate Aggregators */}
          <div className="flex flex-col rounded-2xl border border-rose-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-rose-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                  Exploitative Status Quo
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {t('col_corporate')}
                </h3>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                <XCircle className="size-6" aria-hidden="true" />
              </div>
            </div>

            <ul className="mt-6 flex flex-col gap-5 flex-1 justify-between">
              {comparisonPoints.map((pt) => (
                <li key={pt.title} className="flex flex-col gap-1 text-sm">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    {pt.title}
                  </span>
                  <p className="text-slate-600 pl-3 leading-relaxed">
                    {pt.corp}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Kaithangu Cooperative */}
          <div className="flex flex-col rounded-2xl border-2 border-[#138808] bg-white p-6 shadow-md relative overflow-hidden ring-1 ring-[#138808]/20">
            {/* Top highlight ribbon */}
            <div className="absolute top-0 right-0 rounded-bl-xl bg-[#0b3a75] px-3.5 py-1 text-[11px] font-bold tracking-wide uppercase text-white shadow-xs">
              Ministry of Cooperation
            </div>

            <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#138808]">
                  National Cooperative Model
                </span>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {t('col_cooperative')}
                </h3>
              </div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-[#138808] border border-emerald-200">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </div>
            </div>

            <ul className="mt-6 flex flex-col gap-5 flex-1 justify-between">
              {comparisonPoints.map((pt) => (
                <li key={pt.title} className="flex flex-col gap-1 text-sm">
                  <span className="font-bold text-[#07254d] flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-[#138808] shrink-0" />
                    {pt.title}
                  </span>
                  <p className="text-slate-700 pl-5 leading-relaxed font-medium">
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
