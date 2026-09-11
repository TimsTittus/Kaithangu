'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { type PropsWithChildren, useState } from 'react';
import superjson from 'superjson';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';

export const trpc = createTRPCReact<AppRouter>();

let clientQueryClientSingleton: QueryClient;
function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  return (clientQueryClientSingleton ??= makeQueryClient());
}

function getUrl() {
  const base = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';
  return new URL(base).origin + '/api/trpc';
}

export function TRPCProvider(props: PropsWithChildren) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    </trpc.Provider>
  );
}
