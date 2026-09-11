import { MessageSquareQuote, Quote } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function TestimonialsSection() {
  const t = await getTranslations('landing');

  return (
    <section className="py-12 md:py-20 bg-neutral-100/60 dark:bg-[#0c1813]/60">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/90 px-3.5 py-1 text-xs font-bold text-amber-900 border border-amber-300/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/40">
            <MessageSquareQuote
              className="size-3.5 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <span>{t('testimonials_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-neutral-950 dark:text-white">
            {t('testimonials_title')}
          </h2>
        </div>

        {/* Testimonials Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Worker */}
          <div className="flex flex-col justify-between rounded-3xl border border-emerald-900/10 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#111f18]">
            <Quote className="size-8 text-emerald-600/40 dark:text-emerald-400/40" />
            <p className="mt-4 text-base sm:text-lg text-neutral-800 dark:text-neutral-200 leading-relaxed italic">
              &ldquo;{t('quote_1_text')}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-700 font-bold text-white text-sm">
                MK
              </div>
              <div className="text-sm font-bold text-neutral-900 dark:text-white">
                {t('quote_1_author')}
              </div>
            </div>
          </div>

          {/* Card 2: Customer */}
          <div className="flex flex-col justify-between rounded-3xl border border-emerald-900/10 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-[#111f18]">
            <Quote className="size-8 text-amber-600/40 dark:text-amber-400/40" />
            <p className="mt-4 text-base sm:text-lg text-neutral-800 dark:text-neutral-200 leading-relaxed italic">
              &ldquo;{t('quote_2_text')}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-600 font-bold text-white text-sm">
                AN
              </div>
              <div className="text-sm font-bold text-neutral-900 dark:text-white">
                {t('quote_2_author')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
