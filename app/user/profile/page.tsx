import { ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AudioLabel } from '@/components/AudioLabel';
import { LogoutButton } from '@/components/LogoutButton';
import { formatPaise } from '@/components/money';
import { mutedTextClass, pageClass } from '@/components/ui';
import { getContext, getSession } from '@/server/auth/context';
import { getBookingService } from '@/server/services';
import { UserLanguageDropdown } from '../UserLanguageDropdown';

/**
 * The customer's own profile: identity from the session, activity counted from
 * the booking service. Nothing here is invented — a figure the services do not
 * know is simply not shown.
 */
export default async function CustomerProfilePage() {
  const [session, bookings, locale, t, common, home] = await Promise.all([
    getSession(),
    getBookingService().listBookings(await getContext()),
    getLocale(),
    getTranslations('profile'),
    getTranslations('common'),
    getTranslations('home'),
  ]);

  const title = t('title');
  const name = session?.user.name ?? t('no_name');
  const completed = bookings.filter((b) => b.status === 'completed');
  const spentPaise = completed.reduce((total, b) => total + b.totalPaise, 0);

  const links = [
    { href: '/user/bookings', icon: CalendarDays, label: t('open_bookings') },
    { href: '/user/analytics', icon: BarChart3, label: t('open_analytics') },
  ];

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/user"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition-all hover:bg-neutral-50 active:scale-95 dark:border-neutral-800 dark:bg-neutral-900"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <h1 className="truncate text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {title}
        </h1>

        <div className="flex shrink-0 items-center gap-1.5">
          <AudioLabel k="profile.title" text={title} />
        </div>
      </header>

      {/* Identity: name, verified role and phone all come from the session. */}
      <section className="flex flex-col items-center rounded-3xl border border-emerald-950/10 bg-white p-6 text-center shadow-xs dark:border-white/10 dark:bg-[#101e18]">
        <div className="relative mb-3 flex size-20 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-3xl font-extrabold text-white shadow-md shadow-emerald-600/20">
          <span aria-hidden>{name.charAt(0)}</span>
          <div className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-emerald-700 text-white ring-2 ring-white dark:ring-[#101e18]">
            <CheckCircle2 aria-hidden className="size-4" />
          </div>
        </div>

        <h2
          className="text-xl font-bold break-words text-neutral-900 dark:text-white"
          data-testid="profile-name"
        >
          {name}
        </h2>
        <span className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {t('role_customer')}
        </span>

        <dl className="mt-4 flex w-full flex-col items-center gap-0.5">
          <dt className={`${mutedTextClass} text-xs`}>{t('phone')}</dt>
          <dd className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
            {session?.user.phone}
          </dd>
        </dl>
      </section>

      {/* Activity, counted from this customer's own bookings. */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {t('activity')}
        </h2>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span
              className="text-lg font-bold text-neutral-900 dark:text-white"
              data-testid="profile-bookings"
            >
              {bookings.length}
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('bookings_count')}
            </span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {completed.length}
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('completed_count')}
            </span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-lg font-bold text-neutral-900 dark:text-white">
              {formatPaise(spentPaise, locale)}
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {home('expenses_count')}
            </span>
          </div>
        </div>
      </section>

      {/* Account: language, and the customer's other screens. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{t('account')}</h2>
        <div className="flex flex-col divide-y divide-neutral-100 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xs dark:divide-white/5 dark:border-white/10 dark:bg-[#101e18]">
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm font-bold text-neutral-900 dark:text-white">
              {t('language')}
            </span>
            <UserLanguageDropdown next="/user/profile" />
          </div>

          {links.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-14 items-center justify-between gap-3 p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-white/5"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="text-sm font-bold text-neutral-900 dark:text-white">{label}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-neutral-400" />
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-2">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
