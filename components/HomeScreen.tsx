import Link from 'next/link';
import { Bell, Landmark, User } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { AudioButton } from './AudioButton';
import { formatPaise } from './money';
import { LogoutButton } from './LogoutButton';
import { pageClass } from './ui';

type HomeKind = 'user' | 'worker' | 'corporate';

export interface HomeStats {
  earningsPaise?: number;
  welfarePaise?: number;
  jobsDone?: number;
  rating?: number;
  acceptancePct?: number;
}

const PROFILE_HREF: Readonly<Record<HomeKind, string>> = {
  user: '/user/profile',
  worker: '/worker/profile',
  corporate: '/corporate/profile',
};

/** Home for worker and other role portals that share this layout. */
export async function HomeScreen({ kind, stats }: { kind: HomeKind; stats?: HomeStats }) {
  const [t, common, locale] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    getLocale(),
  ]);
  const title = t(`${kind}_title`);
  const body = t(`${kind}_body`);
  const profileHref = PROFILE_HREF[kind];
  const earnings = stats?.earningsPaise ?? 1_845_000;
  const welfare = stats?.welfarePaise ?? 184_500;
  const jobsDone = stats?.jobsDone ?? 24;
  const rating = stats?.rating ?? 4.9;
  const acceptancePct = stats?.acceptancePct ?? 100;

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <Landmark className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">
              Kaithangu
            </span>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 capitalize">
              {kind} Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <Bell className="size-5 text-neutral-700 dark:text-neutral-300" />
          </div>
          <Link
            href={profileHref}
            className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm hover:bg-emerald-100/80 active:scale-95 transition-all"
            aria-label="Profile"
            data-testid="profile-link"
          >
            <User className="size-5" />
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1
            className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
            data-testid="home-title"
          >
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
        </div>
        <AudioButton text={`${title}. ${body}`} />
      </div>

      {kind === 'worker' && (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00b074] via-[#059669] to-[#10b981] p-5 text-white shadow-xl shadow-emerald-700/20">
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-emerald-100">
                <span>30-Day Earnings</span>
                <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-bold">
                  <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
                  Available
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight">
                  {formatPaise(earnings, locale)}
                </span>
                <span className="text-xs text-emerald-100">INR</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/20">
                <span>Welfare Allocation: {formatPaise(welfare, locale)}</span>
                <span>Direct Payout Ready</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-neutral-900 dark:text-white">
                {jobsDone}
              </span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Jobs Done
              </span>
            </div>
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {rating.toFixed(1)} ★
              </span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Rating
              </span>
            </div>
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-neutral-900 dark:text-white">
                {acceptancePct}%
              </span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Acceptance
              </span>
            </div>
          </div>
        </>
      )}

      <div className="mt-auto">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
