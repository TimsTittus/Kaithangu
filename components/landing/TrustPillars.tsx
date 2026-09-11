import { AlertTriangle, Cpu, Hash, KeyRound, PhoneCall, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function TrustPillars() {
  const t = await getTranslations('landing');

  const pillars = [
    {
      icon: PhoneCall,
      color: 'bg-blue-50 text-[#0b3a75] border border-blue-200',
      title: t('pillar_1_title'),
      desc: t('pillar_1_desc'),
    },
    {
      icon: KeyRound,
      color: 'bg-emerald-50 text-[#138808] border border-emerald-200',
      title: t('pillar_2_title'),
      desc: t('pillar_2_desc'),
    },
    {
      icon: Hash,
      color: 'bg-purple-50 text-purple-800 border border-purple-200',
      title: t('pillar_3_title'),
      desc: t('pillar_3_desc'),
    },
    {
      icon: Cpu,
      color: 'bg-amber-50 text-amber-800 border border-amber-200',
      title: t('pillar_4_title'),
      desc: t('pillar_4_desc'),
    },
    {
      icon: AlertTriangle,
      color: 'bg-rose-50 text-rose-700 border border-rose-200',
      title: t('pillar_5_title'),
      desc: t('pillar_5_desc'),
    },
  ];

  return (
    <section className="py-12 md:py-20 bg-white border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-[#0b3a75] border border-blue-200 shadow-2xs">
            <ShieldCheck
              className="size-3.5 text-[#0b3a75]"
              aria-hidden="true"
            />
            <span>{t('pillars_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#07254d]">
            {t('pillars_title')}
          </h2>
        </div>

        {/* Pillars Cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-[#0b3a75]/40 hover:shadow-sm transition-all"
              >
                <div className={`flex size-12 items-center justify-center rounded-xl ${p.color}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
