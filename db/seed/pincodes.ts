import { existsSync, readFileSync } from 'node:fs';
import { haversineDistanceM, type LngLat } from '@/lib/core';
import Papa from 'papaparse';
import { z } from 'zod';

export interface PincodeRow {
  pincode: string;
  officeName: string;
  district: string;
  stateName: string;
  location: LngLat;
}

export interface PincodeImportReport {
  stateRows: number;
  kept: number;
  skippedMalformed: number;
  skippedNoCoordinates: number;
  skippedDistrictOutlier: number;
}

// India Post "all India pincode directory" CSV columns (see data/raw/pincodes.csv).
const csvRow = z.object({
  officename: z.string().trim().min(1),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/),
  district: z.string().trim().min(1),
  statename: z.string().trim().min(1),
  latitude: z.string().trim(),
  longitude: z.string().trim(),
});

function parseCoordinate(latText: string, lngText: string): LngLat | null {
  if (latText === '' || lngText === '') return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[sorted.length % 2 === 0 ? mid - 1 : mid];
  if (upper === undefined || lower === undefined) throw new RangeError('median of empty list');
  return (lower + upper) / 2;
}

/**
 * Parse the pincode CSV and keep rows of one state with usable coordinates.
 * A row is dropped when its coordinates are missing/invalid, or when it lies
 * more than `maxDistrictOffsetM` from the median coordinate of its district
 * (the source contains rows geocoded to the wrong district). The median comes
 * from the data itself; no coordinates are hand-entered.
 */
export function parsePincodeCsv(
  csvText: string,
  stateName: string,
  maxDistrictOffsetM: number,
): { rows: PincodeRow[]; report: PincodeImportReport } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const wanted = stateName.toUpperCase();
  const report: PincodeImportReport = {
    stateRows: 0,
    kept: 0,
    skippedMalformed: 0,
    skippedNoCoordinates: 0,
    skippedDistrictOutlier: 0,
  };
  const candidates: PincodeRow[] = [];
  for (const raw of parsed.data) {
    if ((raw.statename ?? '').trim().toUpperCase() !== wanted) continue;
    report.stateRows++;
    const row = csvRow.safeParse(raw);
    if (!row.success) {
      report.skippedMalformed++;
      continue;
    }
    const location = parseCoordinate(row.data.latitude, row.data.longitude);
    if (!location) {
      report.skippedNoCoordinates++;
      continue;
    }
    candidates.push({
      pincode: row.data.pincode,
      officeName: row.data.officename,
      district: row.data.district.toUpperCase(),
      stateName: row.data.statename.toUpperCase(),
      location,
    });
  }

  const byDistrict = new Map<string, PincodeRow[]>();
  for (const row of candidates) {
    const list = byDistrict.get(row.district) ?? [];
    list.push(row);
    byDistrict.set(row.district, list);
  }
  const rows: PincodeRow[] = [];
  for (const list of byDistrict.values()) {
    const centre: LngLat = {
      lat: median(list.map((r) => r.location.lat)),
      lng: median(list.map((r) => r.location.lng)),
    };
    for (const row of list) {
      if (haversineDistanceM(centre, row.location) > maxDistrictOffsetM) {
        report.skippedDistrictOutlier++;
      } else {
        rows.push(row);
      }
    }
  }
  report.kept = rows.length;
  return { rows, report };
}

/** Read the pincode CSV, failing with an actionable message when it is missing. */
export function readPincodeCsv(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `Pincode source file not found: ${path}\n` +
        'Place the India Post pincode directory CSV there (columns: officename, pincode, ' +
        'district, statename, latitude, longitude). Coordinates are never invented.',
    );
  }
  return readFileSync(path, 'utf8');
}
