import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePincodeCsv, readPincodeCsv } from './pincodes';

// Synthetic rows: fictional office names and coordinates, not real places.
const HEADER =
  'circlename,regionname,divisionname,officename,pincode,officetype,delivery,district,statename,latitude,longitude';
const row = (
  office: string,
  pin: string,
  district: string,
  state: string,
  lat: string,
  lng: string,
) => `"C","R","D","${office}",${pin},BO,Delivery,"${district}",${state},${lat},${lng}`;

const CSV = [
  HEADER,
  row('Alpha BO', '600001', 'NORTH', 'TESTLAND', '10.00', '20.00'),
  row('Beta BO', '600002', 'NORTH', 'TESTLAND', '10.01', '20.01'),
  row('Gamma BO', '600003', 'NORTH', 'TESTLAND', '10.02', '20.02'),
  // 1 degree away (~110 km): geocoded to the wrong district.
  row('Stray BO', '600004', 'NORTH', 'TESTLAND', '11.00', '20.00'),
  row('Blank BO', '600005', 'NORTH', 'TESTLAND', 'NA', 'NA'),
  row('Zero BO', '600006', 'NORTH', 'TESTLAND', '0', '0'),
  row('Bad pin BO', '06000', 'NORTH', 'TESTLAND', '10.00', '20.00'),
  row('South BO', '600010', 'SOUTH', 'TESTLAND', '9.00', '21.00'),
  row('Elsewhere BO', '700001', 'EAST', 'OTHERLAND', '10.00', '20.00'),
].join('\n');

describe('parsePincodeCsv', () => {
  const { rows, report } = parsePincodeCsv(CSV, 'testland', 50_000);

  it('keeps only rows of the requested state with usable coordinates', () => {
    expect(rows.map((r) => r.officeName).sort()).toEqual([
      'Alpha BO',
      'Beta BO',
      'Gamma BO',
      'South BO',
    ]);
    expect(rows.find((r) => r.officeName === 'Alpha BO')).toEqual({
      pincode: '600001',
      officeName: 'Alpha BO',
      district: 'NORTH',
      stateName: 'TESTLAND',
      location: { lat: 10, lng: 20 },
    });
  });

  it('reports why rows were skipped', () => {
    expect(report).toEqual({
      stateRows: 8,
      kept: 4,
      skippedMalformed: 1,
      skippedNoCoordinates: 2,
      skippedDistrictOutlier: 1,
    });
  });

  it('keeps the stray row when the outlier threshold is wide enough', () => {
    expect(parsePincodeCsv(CSV, 'TESTLAND', 200_000).report.skippedDistrictOutlier).toBe(0);
  });

  it('returns nothing for an unknown state', () => {
    expect(parsePincodeCsv(CSV, 'NOWHERE', 50_000).rows).toEqual([]);
  });
});

describe('readPincodeCsv', () => {
  it('fails with a clear message when the file is missing', () => {
    expect(() => readPincodeCsv('/definitely/missing/pincodes.csv')).toThrow(
      /Pincode source file not found/,
    );
  });

  it('reads an existing file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'pincodes-')), 'p.csv');
    writeFileSync(file, HEADER);
    expect(readPincodeCsv(file)).toBe(HEADER);
  });
});
