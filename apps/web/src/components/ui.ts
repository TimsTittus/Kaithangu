// Shared class names: 48 px touch targets, ≥ 16 px text, AA contrast in light
// and dark mode (AGENTS.md 7).
const focus =
  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';

export const pageClass = 'mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6';

export const primaryButtonClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-lg font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 ${focus}`;

export const secondaryButtonClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-current px-4 text-lg font-semibold disabled:opacity-60 ${focus}`;

export const emergencyButtonClass = `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-lg font-bold text-white hover:bg-red-800 disabled:opacity-60 ${focus}`;

export const iconButtonClass = `inline-flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-current ${focus}`;

export const inputClass = `min-h-12 w-full rounded-xl border-2 border-neutral-500 bg-transparent px-3 text-lg ${focus}`;

/** A large selectable card (radio-like choices). */
export const choiceClass = `flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-start text-lg ${focus}`;

export const choiceSelectedClass = 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950';

export const choiceIdleClass = 'border-neutral-300 dark:border-neutral-600';

export const cardClass =
  'flex flex-col gap-3 rounded-2xl border-2 border-neutral-300 p-4 dark:border-neutral-600';

export const mutedTextClass = 'text-base text-neutral-700 dark:text-neutral-300';

export const errorTextClass = 'text-base font-medium text-red-700 dark:text-red-300';
