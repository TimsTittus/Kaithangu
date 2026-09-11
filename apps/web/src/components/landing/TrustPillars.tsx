import { AlertTriangle, Cpu, Hash, KeyRound, PhoneCall, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function TrustPillars() {
  const t = await getTranslations('landing');

  const pillars = [
    {
      icon: PhoneCall,
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      title: t('pillar_1_title'),
      desc: t('pillar_1_desc'),
    },
    {
      icon: KeyRound,
      color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      title: t('pillar_2_title'),
      desc: t('pillar_2_desc'),
    },
    {
      icon: Hash,
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
      title: t('pillar_3_title'),
      desc: t('pillar_3_desc'),
    },
    {
      icon: Cpu,
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      title: t('pillar_4_title'),
      desc: t('pillar_4_desc'),
    },
    {
      icon: AlertTriangle,
      color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
      title: t('pillar_5_title'),
      desc: t('pillar_5_desc'),
    },
  ];

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/40">
            <ShieldCheck
              className="size-3.5 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>{t('pillars_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-neutral-950 dark:text-white">
            {t('pillars_title')}
          </h2>
        </div>

        {/* Pillars Cards */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111f18]"
              >
                <div className={`flex size-12 items-center justify-center rounded-2xl ${p.color}`}>
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
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
