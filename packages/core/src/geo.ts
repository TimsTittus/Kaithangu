/** A WGS84 coordinate in degrees (PostGIS order: x = lng, y = lat). */
export interface LngLat {
  lng: number;
  lat: number;
}

/** IUGG mean Earth radius in metres, used for spherical approximations. */
export const EARTH_MEAN_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

function assertCoordinate(point: LngLat): void {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    Math.abs(point.lat) > 90 ||
    Math.abs(point.lng) > 180
  ) {
    throw new RangeError(`invalid coordinate: ${point.lng},${point.lat}`);
  }
}

function assertDistance(distanceM: number): void {
  if (!Number.isFinite(distanceM) || distanceM < 0) {
    throw new RangeError(`invalid distance: ${distanceM}`);
  }
}

/** Normalise a longitude into [-180, 180). */
function normaliseLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Point reached by travelling `distanceM` metres from `origin` along the
 * initial bearing `bearingDeg` (0 = north, 90 = east) on a sphere.
 * Spherical error versus the WGS84 ellipsoid is well under 0.5 %.
 */
export function destinationPoint(origin: LngLat, bearingDeg: number, distanceM: number): LngLat {
  assertCoordinate(origin);
  assertDistance(distanceM);
  if (!Number.isFinite(bearingDeg)) {
    throw new RangeError(`invalid bearing: ${bearingDeg}`);
  }
  const angular = distanceM / EARTH_MEAN_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lng: normaliseLng(toDeg(lng2)) };
}

/** Great-circle (haversine) distance in metres between two points. */
export function haversineDistanceM(a: LngLat, b: LngLat): number {
  assertCoordinate(a);
  assertCoordinate(b);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MEAN_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Uniformly distributed random point within `radiusM` metres of `origin`.
 * `random` must return values in [0, 1) (inject a seeded generator for
 * deterministic output). sqrt(u) keeps the density uniform over the disk area.
 */
export function randomPointWithin(origin: LngLat, radiusM: number, random: () => number): LngLat {
  assertDistance(radiusM);
  const distance = radiusM * Math.sqrt(random());
  const bearing = 360 * random();
  return destinationPoint(origin, bearing, distance);
}
