import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaithangu',
};

// Locale resolution (profile → NEXT_LOCALE cookie → state default) and the
// per-locale Noto font arrive with next-intl in a later phase.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
