import { describe, expect, it } from 'vitest';
import { formatEwktPoint, parseEwkbPoint } from './geometry';

/** Build EWKB for a point the way PostGIS encodes it (synthetic coordinates). */
function ewkb(
  lng: number,
  lat: number,
  opts: { le?: boolean; srid?: number | null; type?: number } = {},
): string {
  const le = opts.le ?? true;
  const srid = opts.srid === undefined ? 4326 : opts.srid;
  const type = (opts.type ?? 1) | (srid === null ? 0 : 0x20000000);
  const buf = Buffer.alloc(srid === null ? 21 : 25);
  buf.writeUInt8(le ? 1 : 0, 0);
  if (le) buf.writeUInt32LE(type >>> 0, 1);
  else buf.writeUInt32BE(type >>> 0, 1);
  let offset = 5;
  if (srid !== null) {
    if (le) buf.writeUInt32LE(srid, offset);
    else buf.writeUInt32BE(srid, offset);
    offset += 4;
  }
  if (le) {
    buf.writeDoubleLE(lng, offset);
    buf.writeDoubleLE(lat, offset + 8);
  } else {
    buf.writeDoubleBE(lng, offset);
    buf.writeDoubleBE(lat, offset + 8);
  }
  return buf.toString('hex').toUpperCase();
}

describe('parseEwkbPoint', () => {
  it('parses the canonical PostGIS encoding of POINT(1 2) SRID 4326', () => {
    expect(parseEwkbPoint('0101000020E6100000000000000000F03F0000000000000040')).toEqual({
      lng: 1,
      lat: 2,
    });
  });

  it('parses big-endian and SRID-less encodings', () => {
    expect(parseEwkbPoint(ewkb(-3.5, 45.25, { le: false }))).toEqual({ lng: -3.5, lat: 45.25 });
    expect(parseEwkbPoint(ewkb(10, 20, { srid: null }))).toEqual({ lng: 10, lat: 20 });
  });

  it('rejects other SRIDs, geometry types, Z points and malformed input', () => {
    expect(() => parseEwkbPoint(ewkb(1, 2, { srid: 3857 }))).toThrow(/SRID/);
    expect(() => parseEwkbPoint(ewkb(1, 2, { type: 2 }))).toThrow(/2D points/);
    expect(() => parseEwkbPoint(ewkb(1, 2, { type: 0x80000001 }))).toThrow(/2D points/);
    expect(() => parseEwkbPoint('zz')).toThrow(/hex/);
    expect(() => parseEwkbPoint('0101')).toThrow(/too short/);
    expect(() => parseEwkbPoint(`${ewkb(1, 2)}00`)).toThrow(/length/);
  });
});

describe('formatEwktPoint', () => {
  it('writes lon before lat with the SRID prefix', () => {
    expect(formatEwktPoint({ lng: 1.5, lat: -2.25 })).toBe('SRID=4326;POINT(1.5 -2.25)');
  });

  it('rejects non-finite and out-of-range coordinates', () => {
    expect(() => formatEwktPoint({ lng: Number.NaN, lat: 0 })).toThrow(RangeError);
    expect(() => formatEwktPoint({ lng: 0, lat: 90.1 })).toThrow(RangeError);
    expect(() => formatEwktPoint({ lng: 180.1, lat: 0 })).toThrow(RangeError);
  });
});
