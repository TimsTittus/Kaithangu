import { TRADE_CODES } from '@kaithangu/core/trades';
import { getTranslations } from 'next-intl/server';
import { GovtFooter } from './GovtFooter';
import { GovtHeader } from './GovtHeader';
import { HeroSection } from './HeroSection';
import { ModelComparison } from './ModelComparison';
import { TestimonialsSection } from './TestimonialsSection';
import { TradeShowcase } from './TradeShowcase';
import { TrustPillars } from './TrustPillars';
import { WageCalculator } from './WageCalculator';

export async function LandingPage() {
  const tLanding = await getTranslations('landing');
  const tTrade = await getTranslations('trade');

  const tradeNames: Record<string, string> = {};
  for (const code of TRADE_CODES) {
    tradeNames[code] = tTrade(code);
  }

  const calcLabels = {
    badge: tLanding('calc_badge'),
    title: tLanding('calc_title'),
    subtitle: tLanding('calc_subtitle'),
    selectTrade: tLanding('calc_select_trade'),
    selectDuration: tLanding('calc_select_duration'),
    workerReceives: tLanding('calc_worker_receives'),
    workerNote: tLanding('calc_worker_entitlement_note'),
    welfareContribution: tLanding('calc_welfare_contribution'),
    welfareNote: tLanding('calc_welfare_note'),
    platformFee: tLanding('calc_platform_fee'),
    platformNote: tLanding('calc_platform_note'),
    customerTotal: tLanding('calc_customer_total'),
    aggregatorContrast: String(tLanding.raw('calc_aggregator_contrast')),
    ctaButton: tLanding('cta_enter'),
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f8faf9] text-neutral-900 dark:bg-[#08120d] dark:text-neutral-100">
      <GovtHeader />
      <main className="flex-1 flex flex-col">
        <HeroSection />
        <ModelComparison />
        <WageCalculator labels={calcLabels} tradeNames={tradeNames} />
        <TradeShowcase />
        <TrustPillars />
        <TestimonialsSection />
      </main>
      <GovtFooter />
    </div>
  );
}
