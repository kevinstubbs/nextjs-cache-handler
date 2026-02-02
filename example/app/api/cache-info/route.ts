import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const currentTime = new Date().toISOString();

  return NextResponse.json({
    server_time: currentTime,
    timestamp: Date.now(),
    cache_strategies_available: [
      {
        endpoint: '/api/posts/no-cache',
        strategy: 'cache: no-store',
        description: 'Always fetches fresh data, never cached'
      },
      {
        endpoint: '/api/posts/force-cache',
        strategy: 'cache: force-cache',
        description: 'Uses cache indefinitely, only fetches if no cache exists'
      },
      {
        endpoint: '/api/posts/revalidate',
        strategy: 'next: { revalidate: 60 }',
        description: 'Cached for 60 seconds, then revalidated on next request'
      },
      {
        endpoint: '/api/posts/with-tags',
        strategy: 'next: { revalidate: 300, tags: [...] }',
        description: 'Cached for 5 minutes with tags for on-demand invalidation'
      }
    ],
    revalidation: {
      endpoint: '/api/revalidate',
      description: 'Manually revalidate cache tags',
      usage: 'POST /api/revalidate with { "tag": "api-posts" } or GET /api/revalidate?tag=api-posts'
    },
    environment: {
      node_version: process.version,
      next_version: '15+',
      is_production: process.env.NODE_ENV === 'production'
    }
  });
}