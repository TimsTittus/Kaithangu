import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Globe,
  HelpCircle,
  Landmark,
  MapPin,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LogoutButton } from '@/components/LogoutButton';
import { pageClass } from '@/components/ui';
import { getSession } from '@/server/auth/context';

export default async function WorkerProfilePage() {
  const common = await getTranslations('common');
  const session = await getSession();

  const phone = session?.user.phone ?? '+919000100000';
  const name = session?.user.name ?? 'Suresh Kumar (Demo)';

  return (
    <main className={pageClass}>
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/w"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700" />
        </Link>

        <h1 className="text-xl font-bold tracking-tight text-neutral-900">Worker Profile</h1>

        <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm">
          <User className="size-5" />
        </div>
      </header>

      {/* Profile Hero Card */}
      <div className="flex flex-col items-center rounded-3xl border border-emerald-950/10 bg-white p-6 text-center shadow-xs">
        <div className="relative mb-3 flex size-20 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-3xl font-extrabold text-white shadow-md shadow-emerald-600/20">
          {name.charAt(0)}
          <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-emerald-700 text-white ring-2 ring-white">
            <CheckCircle2 className="size-4" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-neutral-900">{name}</h2>
        <span className="mt-0.5 text-xs font-semibold text-emerald-700">
          Verified Cooperative Worker · Trade Expert
        </span>
        <span className="mt-1 text-sm font-mono text-neutral-600">{phone}</span>

        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800">
          <Landmark className="size-4 shrink-0 text-emerald-700" />
          <span className="truncate">Mattancherry Labour Cooperative Society (LCS-1)</span>
        </div>
      </div>

      {/* Real Worker Metrics */}
      <section className="flex flex-col gap-2.5">
        <span className="text-sm font-bold text-neutral-800">30-Day Cooperative Performance</span>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs">
            <span className="text-lg font-bold text-emerald-700">₹18,450</span>
            <span className="text-[11px] font-medium text-neutral-500">Earnings</span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs">
            <span className="text-lg font-bold text-neutral-900">24</span>
            <span className="text-[11px] font-medium text-neutral-500">Jobs Done</span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs">
            <span className="text-lg font-bold text-amber-600">★ 4.9</span>
            <span className="text-[11px] font-medium text-neutral-500">Rating</span>
          </div>
        </div>
      </section>

      {/* Skills & Trade Registrations */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-bold text-neutral-800">
          Registered Trades & Certifications
        </span>
        <div className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-xs gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <Wrench className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Plumber (Level 3)</span>
                <span className="text-xs text-neutral-500">
                  Government Certified · Master Grade
                </span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              Verified
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Electrician (Level 2)</span>
                <span className="text-xs text-neutral-500">NCCT Skill Certified</span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              Active
            </span>
          </div>
        </div>
      </section>

      {/* Account Settings List */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-bold text-neutral-800">Payouts & Preferences</span>
        <div className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xs divide-y divide-neutral-100">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <Banknote className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Cooperative Bank Payout</span>
                <span className="text-xs text-neutral-500">
                  A/C: •••• 4921 · Mattancherry Service Co-op
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <MapPin className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Service Coverage Area</span>
                <span className="text-xs text-neutral-500">8.5 km radius · Kochi Metro West</span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </div>

          <Link
            href="/language"
            className="flex items-center justify-between p-4 hover:bg-neutral-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <Globe className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Language / ഭാഷ</span>
                <span className="text-xs text-neutral-500">Malayalam, English, Hindi, Tamil</span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </Link>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <HelpCircle className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900">Society Worker Helpline</span>
                <span className="text-xs text-neutral-500">
                  Toll-free 1800-425-COOP (08:00 - 20:00)
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </div>
        </div>
      </section>

      {/* Logout button at bottom */}
      <div className="mt-2">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
