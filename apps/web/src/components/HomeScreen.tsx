import Link from 'next/link';
import {
  Bell,
  Landmark,
  User,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AudioButton } from './AudioButton';
import { LogoutButton } from './LogoutButton';
import { pageClass } from './ui';

type HomeKind = 'customer' | 'worker' | 'admin' | 'org';

/** Modern digital cooperative home for worker, admin, and org areas. */
export async function HomeScreen({ kind }: { kind: HomeKind }) {
  const [t, common] = await Promise.all([getTranslations('home'), getTranslations('common')]);
  const title = t(`${kind}_title`);
  const body = t(`${kind}_body`);
  const profileHref =
    kind === 'worker'
      ? '/w/profile'
      : kind === 'admin' || kind === 'org'
        ? '/admin/profile'
        : '/app/profile';

  return (
    <main className={pageClass}>
      {/* Top Header Bar */}
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

      {/* Title & Greeting */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white" data-testid="home-title">
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
        </div>
        <AudioButton text={`${title}. ${body}`} />
      </div>

      {/* Role specific dashboard hero card */}
      {kind === 'worker' && (
        <>
          {/* Worker Hero Earnings Card */}
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
                <span className="text-3xl font-extrabold tracking-tight">₹18,450.00</span>
                <span className="text-xs text-emerald-100">INR</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/20">
                <span>Welfare Allocation: ₹1,845</span>
                <span>Direct Payout Ready</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-neutral-900 dark:text-white">24</span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Jobs Done
              </span>
            </div>
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">4.9 ★</span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Rating
              </span>
            </div>
            <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
              <span className="text-base font-bold text-neutral-900 dark:text-white">100%</span>
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Acceptance
              </span>
            </div>
          </div>
        </>
      )}

      {/* Logout button at bottom */}
      <div className="mt-auto">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
