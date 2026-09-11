import type { PincodeGeocode, PlaceRepo } from '@/lib/core';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '..';
import { pincodes } from '../schema';
import { nearestPincode } from '../sql/places';

export function createPlaceRepo(db: Database): PlaceRepo {
  return {
    async pincodeLocation(pincode) {
      const row = await geocode(db, pincode);
      return row?.location ?? null;
    },

    geocodePincode(pincode) {
      return geocode(db, pincode);
    },

    nearestPincode(point, maxMeters) {
      return nearestPincode(db, point, maxMeters);
    },
  };
}

/** Several post offices can share a pincode; pick one deterministically. */
async function geocode(db: Database, pincode: string): Promise<PincodeGeocode | null> {
  const [row] = await db
    .select({
      location: pincodes.location,
      officeName: pincodes.officeName,
      district: pincodes.district,
      stateName: pincodes.stateName,
    })
    .from(pincodes)
    .where(eq(pincodes.pincode, pincode))
    .orderBy(asc(pincodes.officeName), asc(pincodes.id))
    .limit(1);
  return row ?? null;
}
