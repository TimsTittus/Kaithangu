import type { LngLat } from '@/lib/core';

/** All geometry columns use WGS84 lon/lat (AGENTS.md 5). */
export const SRID = 4326;

const EWKB_SRID_FLAG = 0x20000000;
const EWKB_Z_FLAG = 0x80000000;
const EWKB_M_FLAG = 0x40000000;
const WKB_POINT = 1;

function assertLngLat(point: LngLat): void {
  if (
    !Number.isFinite(point.lng) ||
    !Number.isFinite(point.lat) ||
    Math.abs(point.lng) > 180 ||
    Math.abs(point.lat) > 90
  ) {
    throw new RangeError(`invalid coordinate: ${point.lng},${point.lat}`);
  }
}

/** EWKT literal PostGIS accepts as input for a geometry(Point,4326) column. */
export function formatEwktPoint(point: LngLat): string {
  assertLngLat(point);
  return `SRID=${SRID};POINT(${point.lng} ${point.lat})`;
}

/**
 * Parse the hex EWKB text PostGIS returns for a 2D point. Rejects anything that
 * is not a plain point (Z/M dimensions, other geometry types, wrong SRID).
 */
export function parseEwkbPoint(hex: string): LngLat {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) {
    throw new TypeError('geometry: expected hex EWKB');
  }
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length < 21) {
    throw new TypeError('geometry: EWKB too short for a point');
  }
  const littleEndian = bytes.readUInt8(0) === 1;
  const type = littleEndian ? bytes.readUInt32LE(1) : bytes.readUInt32BE(1);
  if ((type & (EWKB_Z_FLAG | EWKB_M_FLAG)) !== 0 || (type & 0x0fffffff) !== WKB_POINT) {
    throw new TypeError('geometry: only 2D points are supported');
  }
  let offset = 5;
  if ((type & EWKB_SRID_FLAG) !== 0) {
    const srid = littleEndian ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
    if (srid !== SRID) {
      throw new TypeError(`geometry: expected SRID ${SRID}, got ${srid}`);
    }
    offset += 4;
  }
  if (bytes.length !== offset + 16) {
    throw new TypeError('geometry: unexpected EWKB length');
  }
  const readDouble = (at: number): number =>
    littleEndian ? bytes.readDoubleLE(at) : bytes.readDoubleBE(at);
  return { lng: readDouble(offset), lat: readDouble(offset + 8) };
}
