import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The monorepo keeps one .env at the root. Node's loader never overrides
// variables that are already set, so real environments win over the file.
const rootEnvFile = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  transpilePackages: ['@kaithangu/adapters', '@kaithangu/core', '@kaithangu/db', '@kaithangu/i18n'],
};

export default nextConfig;
