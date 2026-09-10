'use client';

import {
  BarChart3,
  CalendarDays,
  Home,
  Siren,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavProps {
  labels: {
    home: string;
    bookings: string;
    emergency: string;
    analytics: string;
    profile: string;
  };
}

export function BottomNav({ labels }: BottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/app',
      label: labels.home,
      icon: Home,
      isActive: pathname === '/app',
    },
    {
      href: '/app/bookings',
      label: labels.bookings,
      icon: CalendarDays,
      isActive: pathname.startsWith('/app/bookings'),
    },
    {
      href: '/app/emergency',
      label: labels.emergency,
      icon: Siren,
      isActive: pathname.startsWith('/app/emergency'),
      isHighlight: true,
    },
    {
      href: '/app/analytics',
      label: labels.analytics,
      icon: BarChart3,
      isActive: pathname.startsWith('/app/analytics'),
    },
    {
      href: '/language',
      label: labels.profile,
      icon: User,
      isActive: pathname.startsWith('/language'),
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-md border-t border-emerald-950/10 bg-white/95 px-3 py-2 backdrop-blur-lg dark:border-white/10 dark:bg-[#0c1813]/95"
    >
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.isHighlight) {
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl p-1 transition-all ${
                    item.isActive
                      ? 'scale-105 text-red-600 dark:text-red-400'
                      : 'text-red-500 hover:text-red-700 dark:text-red-400'
                  }`}
                  aria-label={item.label}
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60 shadow-sm">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl p-1 transition-all ${
                  item.isActive
                    ? 'font-bold text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-500 hover:text-emerald-700 dark:text-neutral-400 dark:hover:text-emerald-300'
                }`}
                aria-label={item.label}
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                    item.isActive ? 'bg-emerald-100/70 dark:bg-emerald-950/60' : ''
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-[11px] leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
