import { parse } from 'yaml';
import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'invalid date');

// Matches the team-supplied data/seed/festivals.yaml; extra descriptive fields
// (location, description, tags, …) are accepted and ignored.
const festivalEntry = z
  .object({
    name: z.string().trim().min(1),
    malayalamName: z.string().trim().min(1),
    startDate: isoDate,
    endDate: isoDate,
    is_placeholder: z.boolean().default(false),
  })
  .refine((f) => f.endDate >= f.startDate, { message: 'endDate is before startDate' });

const festivalsFile = z.object({ festivals: z.array(festivalEntry).min(1) });

export interface FestivalSeed {
  nameKey: string;
  names: { en: string; ml: string };
  startDate: string;
  endDate: string;
  isPlaceholder: boolean;
}

/** i18n key for a festival name, e.g. "Eid al-Fitr" → "festival.eid_al_fitr". */
export function festivalNameKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (slug === '') throw new Error(`festival name has no ASCII letters: ${name}`);
  return `festival.${slug}`;
}

export function parseFestivals(yamlText: string, source: string): FestivalSeed[] {
  const result = festivalsFile.safeParse(parse(yamlText));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid festivals file ${source}:\n  ${issues.join('\n  ')}`);
  }
  return result.data.festivals.map((f) => ({
    nameKey: festivalNameKey(f.name),
    names: { en: f.name, ml: f.malayalamName },
    startDate: f.startDate,
    endDate: f.endDate,
    isPlaceholder: f.is_placeholder,
  }));
}
