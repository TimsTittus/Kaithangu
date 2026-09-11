// Shared class names: 48 px touch targets, ≥ 16 px text, AA contrast in light
// and dark mode (AGENTS.md 7).
const focus =
  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';

export const pageClass = 'mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-28';

export const primaryButtonClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-lg font-semibold text-white shadow-sm hover:bg-emerald-800 active:scale-[0.99] transition-all disabled:opacity-60 ${focus}`;

export const secondaryButtonClass = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-4 text-lg font-semibold text-neutral-800 dark:text-neutral-100 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-60 ${focus}`;

export const emergencyButtonClass = `inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 px-4 text-lg font-bold text-white shadow-md shadow-rose-900/10 hover:from-red-700 hover:to-rose-700 active:scale-[0.99] transition-all disabled:opacity-60 ${focus}`;

export const iconButtonClass = `inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-95 transition-all ${focus}`;

export const inputClass = `min-h-12 w-full rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 text-lg shadow-sm transition-all focus-visible:border-emerald-600 ${focus}`;

/** A large selectable card (radio-like choices). */
export const choiceClass = `flex min-h-12 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-start text-lg transition-all ${focus}`;

export const choiceSelectedClass =
  'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/50 shadow-sm';

export const choiceIdleClass =
  'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 hover:border-emerald-300';

export const cardClass =
  'flex flex-col gap-3 rounded-3xl border border-emerald-900/10 dark:border-white/10 bg-white dark:bg-[#101c17] p-5 shadow-[0_4px_20px_rgb(0,0,0,0.04)]';

export const mutedTextClass = 'text-base text-neutral-600 dark:text-neutral-400';

export const errorTextClass = 'text-base font-medium text-red-600 dark:text-red-400';
