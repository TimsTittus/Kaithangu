import { isCertifiedRequired, TRADE_CODES, type TradeCode } from '@/lib/core';

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
