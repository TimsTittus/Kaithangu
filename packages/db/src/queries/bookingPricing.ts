import type { BookingPricingRepo } from '@kaithangu/core';
import type { Database } from '../client';
import { loadPricingInputs } from './pricing';

/** state_config + state_trade_rates in the shape the booking service prices with. */
export function createBookingPricingRepo(db: Database): BookingPricingRepo {
  return {
    async load(stateCode, tradeCode) {
      const inputs = await loadPricingInputs(db, stateCode, tradeCode);
      if (inputs === null) return null;
      const { stateConfig, rates } = inputs;
      return {
        stateConfig: {
          welfarePct: stateConfig.welfarePct,
          platformFeePct: stateConfig.platformFeePct,
          gstPctOnPlatformFee: stateConfig.gstPctOnPlatformFee,
          timezone: stateConfig.timezone,
          isPlaceholder: stateConfig.isPlaceholder,
        },
        rates: {
          wageFloorPerHourPaise: rates.wageFloorPerHourPaise,
          minBillableMinutes: rates.minBillableMinutes,
          visitChargePaise: rates.visitChargePaise,
          emergencySurchargePct: rates.emergencySurchargePct,
          isPlaceholder: rates.isPlaceholder,
        },
      };
    },
  };
}
