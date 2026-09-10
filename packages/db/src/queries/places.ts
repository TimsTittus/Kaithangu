import type { PlaceRepo } from '@kaithangu/core';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { pincodes } from '../schema';
import { nearestPincode } from '../sql/places';

export function createPlaceRepo(db: Database): PlaceRepo {
  return {
    async pincodeLocation(pincode) {
      // Several post offices can share a pincode; pick one deterministically.
      const [row] = await db
        .select({ location: pincodes.location })
        .from(pincodes)
        .where(eq(pincodes.pincode, pincode))
        .orderBy(asc(pincodes.officeName), asc(pincodes.id))
        .limit(1);
      return row?.location ?? null;
    },

    nearestPincode(point, maxMeters) {
      return nearestPincode(db, point, maxMeters);
    },
  };
}
