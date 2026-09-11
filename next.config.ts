import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/app/bookings', destination: '/user/bookings', permanent: false },
      { source: '/app/bookings/:id', destination: '/user/bookings/:id', permanent: false },
      { source: '/app/emergency', destination: '/user/emergency', permanent: false },
      { source: '/app/analytics', destination: '/user/analytics', permanent: false },
      { source: '/app/profile', destination: '/user/profile', permanent: false },
      { source: '/app/book/:trade', destination: '/user/book/:trade', permanent: false },
      { source: '/w', destination: '/worker', permanent: false },
      { source: '/w/:path*', destination: '/worker/:path*', permanent: false },
      { source: '/admin', destination: '/corporate', permanent: false },
      { source: '/admin/:path*', destination: '/corporate/:path*', permanent: false },
      { source: '/org', destination: '/corporate', permanent: false },
      { source: '/org/:path*', destination: '/corporate/:path*', permanent: false },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withNextIntl(nextConfig);
