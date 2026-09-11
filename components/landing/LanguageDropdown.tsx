'use client';

import { chooseLocale } from '@/app/language/actions';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';
import { Check, ChevronDown, Globe, Languages } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';

interface LanguageDropdownProps {
  currentLocale: Locale;
  localeNames: Record<Locale, string>;
}

export function LanguageDropdown({ currentLocale, localeNames }: LanguageDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleSelect(locale: Locale) {
    setIsOpen(false);
    if (locale === currentLocale) return;

    const formData = new FormData();
    formData.append('locale', locale);
    formData.append('next', '/');

    startTransition(async () => {
      await chooseLocale(formData);
    });
  }

  const currentName = localeNames[currentLocale] ?? currentLocale.toUpperCase();

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Google Translate Style Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isPending}
        data-testid="language-dropdown-btn"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Translate page language"
        className="inline-flex min-h-10 items-center justify-between gap-2 rounded-xl border border-neutral-300/90 bg-white/90 px-3 py-1.5 text-xs sm:text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:bg-neutral-50 hover:border-emerald-500/50 active:scale-95 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <div className="flex items-center gap-1.5">
          {/* Dual Icon badge: Google Translate / Globe motif */}
          <div className="flex size-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Languages className="size-3.5" aria-hidden="true" />
          </div>
          <span className="font-bold tracking-tight">{currentName}</span>
        </div>
        <ChevronDown
          className={`size-4 text-neutral-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 focus:outline-none z-50 dark:border-neutral-700 dark:bg-[#121c17]"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase text-neutral-400 border-b border-neutral-100 dark:border-neutral-800 mb-1 flex items-center justify-between">
            <span>Select Language</span>
            <Globe className="size-3 text-neutral-400" />
          </div>

          <div className="flex flex-col gap-0.5">
            {SUPPORTED_LOCALES.map((locale) => {
              const isSelected = locale === currentLocale;
              const name = localeNames[locale] ?? locale;
              return (
                <button
                  key={locale}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-testid={`select-language-${locale}`}
                  onClick={() => handleSelect(locale)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 font-bold text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <span lang={locale}>{name}</span>
                  {isSelected && (
                    <Check
                      className="size-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
