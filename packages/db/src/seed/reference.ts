import { isCertifiedRequired, TRADE_CODES, type TradeCode } from '@kaithangu/core';

/** lucide-react icon name per trade (display names come from i18n `trade.<code>`). */
const TRADE_ICONS: Record<TradeCode, string> = {
  plumber: 'wrench',
  electrician: 'zap',
  carpenter: 'hammer',
  painter: 'paintbrush',
  domestic_help: 'house',
  caregiver: 'heart-handshake',
  driver: 'car',
  gardener: 'sprout',
  cleaner: 'sparkles',
  technician: 'cpu',
};

export const TRADE_ROWS = TRADE_CODES.map((code, index) => ({
  code,
  certifiedRequired: isCertifiedRequired(code),
  icon: TRADE_ICONS[code],
  sortOrder: (index + 1) * 10,
}));

/**
 * Welfare schemes. Eligibility/benefit rules are NOT known yet: rules = {} and
 * is_placeholder = true (TODO_VERIFY) until verified scheme rules are supplied.
 */
export const WELFARE_SCHEME_ROWS = [
  { code: 'pmsby', stateCode: null, nameKey: 'welfare.pmsby', rules: {}, isPlaceholder: true },
  { code: 'pmjjby', stateCode: null, nameKey: 'welfare.pmjjby', rules: {}, isPlaceholder: true },
  {
    code: 'society_welfare_fund',
    stateCode: 'KL',
    nameKey: 'welfare.society_welfare_fund',
    rules: {},
    isPlaceholder: true,
  },
] as const;
