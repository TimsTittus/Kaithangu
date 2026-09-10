'use client';

import { RotateCw } from 'lucide-react';
import { useCommonStrings } from '@/components/CommonStrings';
import { pageClass, primaryButtonClass } from '@/components/ui';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const common = useCommonStrings();
  return (
    <main className={pageClass} role="alert">
      <h1 className="text-2xl font-semibold">{common.errorTitle}</h1>
      <button type="button" className={primaryButtonClass} onClick={() => reset()}>
        <RotateCw aria-hidden className="size-5" />
        {common.retry}
      </button>
    </main>
  );
}
