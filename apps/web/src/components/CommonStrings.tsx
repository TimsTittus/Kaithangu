'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Strings that client-only UI (error boundary, offline banner, audio buttons)
 * needs. Translated on the server in the root layout and passed down, so the
 * client bundle carries no i18n runtime.
 */
export interface CommonStrings {
  locale: string;
  offline: string;
  errorTitle: string;
  retry: string;
  loading: string;
  playAudio: string;
}

const DEFAULT_STRINGS: CommonStrings = {
  locale: 'en',
  offline: 'You are offline.',
  errorTitle: 'Something went wrong',
  retry: 'Try again',
  loading: 'Loading…',
  playAudio: 'Play audio',
};

const CommonStringsContext = createContext<CommonStrings>(DEFAULT_STRINGS);

export function CommonStringsProvider({
  value,
  children,
}: {
  value: CommonStrings;
  children: ReactNode;
}) {
  return <CommonStringsContext value={value}>{children}</CommonStringsContext>;
}

export function useCommonStrings(): CommonStrings {
  return useContext(CommonStringsContext) ?? DEFAULT_STRINGS;
}
