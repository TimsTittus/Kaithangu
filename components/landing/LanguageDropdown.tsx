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
        className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs transition-all hover:bg-slate-50 hover:border-[#0b3a75]/40 active:scale-95 disabled:opacity-50"
      >
        <div className="flex items-center gap-1.5">
          <div className="flex size-5 items-center justify-center rounded bg-blue-50 text-[#0b3a75] border border-blue-200/60">
            <Languages className="size-3.5" aria-hidden="true" />
          </div>
          <span className="font-extrabold tracking-tight">{currentName}</span>
        </div>
        <ChevronDown
          className={`size-4 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0b3a75]' : ''
            }`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-48 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-black/5 focus:outline-none z-50"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-extrabold tracking-wider uppercase text-slate-500 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Select Language</span>
            <Globe className="size-3 text-slate-400" />
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isSelected
                      ? 'bg-blue-50 font-bold text-[#0b3a75] border border-blue-200/50'
                      : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <span lang={locale}>{name}</span>
                  {isSelected && (
                    <Check
                      className="size-4 text-[#0b3a75]"
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
