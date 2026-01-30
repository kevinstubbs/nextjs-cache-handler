import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // logging: {
  //   fetches: {
  //     fullUrl: true,
  //     hmrRefreshes: true,
  //   },
  // },
  cacheHandler: path.resolve(__dirname, './cache-handler.mjs'),
  cacheMaxMemorySize: 0, // disable default in-memory caching
  headers: async () => {
    return [
      {
        // Match all paths using wildcard (excluding API, static assets)
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Surrogate-Key',
            value: 'unknown',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
