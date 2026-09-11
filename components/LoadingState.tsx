'use client';

import { LoaderCircle } from 'lucide-react';
import { useCommonStrings } from './CommonStrings';

export function LoadingState() {
  const { loading } = useCommonStrings();
  return (
    <div role="status" className="flex flex-1 items-center justify-center gap-3 p-6 text-lg">
      <LoaderCircle aria-hidden className="size-6 animate-spin" />
      {loading}
    </div>
  );
}
