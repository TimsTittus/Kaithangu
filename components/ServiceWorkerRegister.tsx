'use client';

import { useEffect } from 'react';
import { useCommonStrings } from './CommonStrings';

/**
 * Registers public/sw.js in production builds and asks it to cache the audio
 * labels of the active locale (AGENTS.md 7: usable offline on slow networks).
 */
export function ServiceWorkerRegister() {
  const { locale } = useCommonStrings();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => {
        registration.active?.postMessage({ type: 'precache-audio', locale });
      })
      .catch(() => {
        // Without a service worker the app still works online.
      });
  }, [locale]);

  return null;
}
