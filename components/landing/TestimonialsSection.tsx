import { MessageSquareQuote, Quote } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function TestimonialsSection() {
  const t = await getTranslations('landing');

  return (
    <section className="py-12 md:py-20 bg-[#f8fafc] border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-bold text-amber-900 border border-amber-300/80 shadow-2xs">
            <MessageSquareQuote
              className="size-3.5 text-amber-700"
              aria-hidden="true"
            />
            <span>{t('testimonials_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#07254d]">
            {t('testimonials_title')}
          </h2>
        </div>

        {/* Testimonials Cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Worker */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
            <Quote className="size-8 text-[#138808]/40" />
            <p className="mt-4 text-base sm:text-lg text-slate-800 leading-relaxed italic">
              &ldquo;{t('quote_1_text')}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#138808] font-bold text-white text-sm shadow-xs">
                MK
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {t('quote_1_author')}
                </div>
                <div className="text-[11px] font-semibold text-[#138808]">
                  Verified Cooperative Member
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Customer */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
            <Quote className="size-8 text-[#0b3a75]/40" />
            <p className="mt-4 text-base sm:text-lg text-slate-800 leading-relaxed italic">
              &ldquo;{t('quote_2_text')}&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-[#0b3a75] font-bold text-white text-sm shadow-xs">
                AN
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {t('quote_2_author')}
                </div>
                <div className="text-[11px] font-semibold text-[#0b3a75]">
                  Verified Citizen
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
